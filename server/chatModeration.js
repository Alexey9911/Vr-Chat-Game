// AI layer — contextual moderation of the GLOBAL chat in the relay (silent).
// Every POLL_MS it reads new rows from Neon chat_messages, sends them to an LLM that
// returns {"actions":[{id,ban}]} and DELETES the flagged ones; plus a backlog scan at
// boot + a periodic rescan. After deleting, onRemoved(ids) lets the relay tell clients
// over the socket (live removal). Authority-impersonation is ALSO swept deterministically
// (no LLM needed). Adapted from football-Game-Copy-V2/server/chatModeration.js (Supabase→Neon).
//
// Keys ONLY via env (NEVER in the repo): CEREBRAS_API_KEYS, GROQ_API_KEYS (comma list;
// rotates on 429/401/400 and from Cerebras to Groq). Without keys the deterministic
// impersonation sweep still runs; only the contextual AI removal is off.
import { hasDb, fetchNewChat, fetchRecentChat, deleteChat } from './db.js'
import { isImpersonationNick } from './impersonation.js'
import { banIps } from './ipBans.js'
import { getIpForPlayer } from './ipMap.js'

// 1 MINUTE everywhere on purpose: a false positive costs only 1 min and self-recovers.
const BAN_LONG_SEC = 60   // authority impersonation (nick or text)
const BAN_SHORT_SEC = 60  // very heavy abuse/slur (NOT a negative opinion or light insult)

const POLL_MS = 4000          // check NEW messages
const RESCAN_MS = 300000      // backlog rescan every 5 min (catches misses)
const BATCH_LIMIT = 25        // max messages per LLM call
const ADMIN_PREFIX = /^\[admin\]\s*/i // alonHouse authenticated-admin display prefix — exempt from the nick filter

const PROVIDERS = [
  {
    name: 'Cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: process.env.CEREBRAS_MODEL || 'gpt-oss-120b',
    keys: (process.env.CEREBRAS_API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean),
    // gpt-oss-120b is a REASONING model: without this it burns tokens "thinking" and
    // leaves content EMPTY (finish_reason: length). low + high tokens = clean JSON.
    body: { reasoning_effort: 'low' },
  },
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    keys: (process.env.GROQ_API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean),
    body: {}, // Groq does NOT accept reasoning_effort → don't send it (400)
  },
]

const SYSTEM_PROMPT = `You are the content moderator for the public chat of Ansem House, a 3D social world / game on Solana with an in-game token. Be VERY lenient: this is a public game chat, let people talk freely and have banter. Your DEFAULT is to KEEP a message. You receive a JSON array of chat messages, each {"id": string, "nick": string, "text": string}. The "nick" is the sender's display name — use it to detect impersonation.

For each message decide an ACTION + a BAN level:
- ACTION: remove it, or keep it (default = keep).
- BAN (only when removing): "long" = impersonating authority, "short" = heavy abuse, "none" = just remove.

Remove + BAN "long" (authority impersonation — remove the message WHATEVER it says):
- The "nick" claims to be staff/authority: admin, administrator, moderator, mod, staff, owner, team, dev, developer, support, official, system, founder. This INCLUDES deliberate misspellings/variations and padding to dodge filters: "devv", "deevv", "d3v", "adminnn", "addmin", "0fficial", "M0D", "House Dev", "Official Mod", "the_admin", etc. If the nick reads as authority/staff in ANY form, it is impersonation.
- OR the TEXT claims authority: "im the real dev", "im admin", "official announcement", "team here", "staff speaking".

Remove + BAN "short" (heavy abuse — crossed the line):
- Slurs or hate speech (racial, homophobic, etc.), incl. leetspeak ("n166r", "f4gg0t").
- Very heavy/abusive insults, harassment or real threats targeted at a person ("kill yourself", doxxing, repeated targeted abuse), OR EXTREME, vile insulting of the project/team (a torrent of abuse, not an opinion).
- Sexual, graphic, or NSFW content.

Remove + BAN "none" (clean it up, no ban):
- Spam / shilling: flooding the same text, gibberish walls, scam/phishing links, OR pasting a token contract address / mint to shill ("CA: <addr>", a long base58 string ending in "pump", "100x", "next gem", promoting another coin).
- MALICIOUS scam-FUD meant to manipulate (calling it a rug/scam to make people dump, "dev rugged and ran", false reward claims).

KEEP everything else (do NOT remove, do NOT ban):
- Opinions, criticism and COMPLAINTS, even harsh/negative ones: "this is laggy", "this game is bad", "the matchmaking sucks", "this is boring", "the dev should fix X". A negative opinion about the game is NEVER removed.
- Light insults, jokes, banter, trash talk, a casual "fuck you" between players, "ez", "you suck", "git gud".
- Greetings, "gg", "lol", emotes, questions, help, normal talk.

The line: a negative opinion or a LIGHT insult about the project is fine (keep). Authority impersonation (any spelling) -> remove + ban long. Slurs / NSFW / a heavy torrent of abuse -> remove + ban short. Spam/CA/scam-FUD -> remove, no ban. When unsure between keep and remove, KEEP.

Respond with ONLY a JSON object: {"actions": [{"id": <id>, "ban": "long"|"short"|"none"}, ...]}. The "id" is the message's string id, copied verbatim. List ONLY messages to remove. No prose. If nothing, respond {"actions": []}.`

let lastTs = 0
let started = false
let keyIdx = 0
let onRemovedCb = null

function ipsForRows(rows) {
  // resolve author IPs via the relay's player_id->ip map (chat_messages has no ip column)
  const ips = []
  for (const r of rows) { const ip = getIpForPlayer(r.player_id); if (ip) ips.push(ip) }
  return ips
}

async function callLLM(userContent) {
  for (const p of PROVIDERS) {
    if (!p.keys.length) continue
    for (let i = 0; i < p.keys.length; i++) {
      const key = p.keys[(keyIdx + i) % p.keys.length]
      try {
        const res = await fetch(p.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: p.model,
            temperature: 0,
            max_tokens: 3000,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            ...(p.body || {}),
          }),
        })
        if (!res.ok) continue // 429/401/400 → next key/provider
        const data = await res.json()
        const text = data?.choices?.[0]?.message?.content
        if (text && text.trim()) { keyIdx = (keyIdx + i + 1) % p.keys.length; return text }
      } catch { /* network/timeout → next */ }
    }
  }
  return null
}

// returns [{id:string, ban:'long'|'short'|'none'}]
function parseActions(text) {
  if (!text) return []
  try {
    const m = text.match(/\{[\s\S]*\}/)
    const obj = JSON.parse(m ? m[0] : text)
    if (Array.isArray(obj?.actions)) {
      return obj.actions
        .map((a) => ({ id: String(a?.id ?? ''), ban: ['long', 'short'].includes(a?.ban) ? a.ban : 'none' }))
        .filter((a) => a.id)
    }
    if (Array.isArray(obj?.remove)) {
      return obj.remove.map((n) => ({ id: String(n), ban: 'none' })).filter((a) => a.id)
    }
  } catch { /* invalid json */ }
  return []
}

async function moderateBatch(rows) {
  if (!rows || !rows.length) return 0
  const byId = new Map(rows.map((r) => [String(r.id), r]))
  const payload = JSON.stringify(rows.map((m) => ({
    id: String(m.id), nick: String(m.nick || '').slice(0, 40), text: String(m.msg || '').slice(0, 280),
  })))
  const actions = parseActions(await callLLM(payload))
  if (!actions.length) return 0
  const ids = actions.map((a) => a.id)
  const longRows = actions.filter((a) => a.ban === 'long').map((a) => byId.get(a.id)).filter(Boolean)
  const shortRows = actions.filter((a) => a.ban === 'short').map((a) => byId.get(a.id)).filter(Boolean)
  const longIps = ipsForRows(longRows)
  const shortIps = ipsForRows(shortRows)
  await deleteChat(ids)
  try { onRemovedCb?.(ids) } catch {}
  if (longIps.length) banIps(longIps, BAN_LONG_SEC, 'impersonation')
  if (shortIps.length) banIps(shortIps, BAN_SHORT_SEC, 'abuse')
  console.log(`[mod] removed ${ids.length} (ban long:${longRows.length} short:${shortRows.length})`)
  return ids.length
}

// DETERMINISTIC impersonation sweep (no LLM): scans recent nicks, deletes impersonators,
// bans their IP 1min, notifies clients over the socket. Re-entry guarded.
let sweeping = false
async function sweepImpersonation(limit = 500) {
  if (!hasDb() || sweeping) return 0
  sweeping = true
  try {
    const rows = await fetchRecentChat(limit)
    const bad = rows.filter((r) => isImpersonationNick(String(r.nick || '').replace(ADMIN_PREFIX, '')))
    if (!bad.length) return 0
    const ids = bad.map((r) => String(r.id))
    const ips = ipsForRows(bad)
    await deleteChat(ids)
    try { onRemovedCb?.(ids) } catch {}
    if (ips.length) banIps(ips, BAN_LONG_SEC, 'impersonation')
    console.log(`[mod] impersonation: removed ${ids.length}, IPs banned ${new Set(ips).size}`)
    return ids.length
  } catch (err) { console.error('[mod] sweep error:', err.message); return 0 }
  finally { sweeping = false }
}

let ticking = false
async function tick() {
  if (!hasDb() || ticking) return
  ticking = true
  try {
    const rows = await fetchNewChat(lastTs, BATCH_LIMIT)
    if (!rows.length) return
    lastTs = Number(rows[rows.length - 1].ts_ms) || lastTs
    await moderateBatch(rows)
  } catch (err) { console.error('[mod] tick error:', err.message) }
  finally { ticking = false }
}

async function scanBacklog(limit = 200) {
  if (!hasDb()) return
  try {
    const recent = await fetchRecentChat(limit)
    if (!recent.length) return
    const rows = recent.slice().reverse() // oldest → newest
    let total = 0
    for (let i = 0; i < rows.length; i += BATCH_LIMIT) total += await moderateBatch(rows.slice(i, i + BATCH_LIMIT))
    console.log(`[mod] backlog (${rows.length}) — removed ${total}`)
  } catch (err) { console.error('[mod] backlog error:', err.message) }
}

// opts: { onRemoved(ids) } → relay purges its cache and tells clients over the socket
export async function startChatModeration(opts = {}) {
  if (started) return
  onRemovedCb = typeof opts.onRemoved === 'function' ? opts.onRemoved : null
  if (!hasDb()) { console.warn('⚠️  Chat moderation OFF (no DATABASE_URL)'); return }
  started = true

  // IMPERSONATION: deterministic sweep (NO LLM/keys needed). Runs ALWAYS — clears the
  // historic backlog once at boot (high cap) and notifies live, then every minute.
  void sweepImpersonation(2000)
  setInterval(() => void sweepImpersonation(120), 60000)

  const hasKeys = PROVIDERS.some((p) => p.keys.length)
  if (!hasKeys) {
    console.warn('⚠️  Chat AI OFF (no CEREBRAS_API_KEYS/GROQ_API_KEYS) — impersonation IS still filtered')
    return
  }
  try {
    const recent = await fetchRecentChat(1)
    lastTs = recent.length ? (Number(recent[0].ts_ms) || 0) : 0
  } catch {}
  console.log(`🤖 Chat moderation ON (from ts ${lastTs}, poll ${POLL_MS}ms)`)
  void scanBacklog()
  setInterval(() => void tick(), POLL_MS)
  setInterval(() => void scanBacklog(60), RESCAN_MS)
}
