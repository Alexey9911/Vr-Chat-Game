// Deterministic, in-RAM, socket-level chat anti-spam for the WebSocket relay.
// Ported from football-Game-Copy-V2/server/chatGuard.js, adapted to alonHouse's plain-WS
// relay + the user's rules: cooldown = 1s, repeated phrase/chars -> mute, slur -> mute,
// authority nick -> handled by the relay (1-min IP ban). Everything is SILENT (the frame
// is simply not fanned out; the sender gets no feedback).
import { isImpersonationNick } from './impersonation.js'

const SLUR = /(nigg|niggr|faggot|fagg|kike|chink|spic|retard)/
const LEET = { 1: 'i', '!': 'i', '|': 'i', 3: 'e', 0: 'o', 4: 'a', 7: 't', $: 's', 5: 's', '@': 'a', 6: 'g' }

// Normalize for slur/flood matching: leet -> letters, then collapse repeated chars so
// "aaaaaaaa", "loooool" and "!!!!!!" all fold to a stable key (repeated chars -> mute).
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[1!|3047$5@6]/g, (c) => LEET[c] || '')
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1') // 3+ repeats -> 2 (collapse spammy runs)
}

// ── knobs (the user's spec) ────────────────────────────────────────────────
const COOLDOWN_MS = 1000      // RULE: 1-second cooldown per connection (football used 2000)
const NOREPEAT_MS = 60000     // same exact text from the same connection within 60s -> mute
const IP_WINDOW_MS = 10000    // per-IP rate-limit window
const IP_MAX = 6              // max messages per IP in the window
const BAN_MS = 5 * 60 * 1000  // 5-min strike ban (3 strikes) — kept from football
const STRIKE_WINDOW_MS = 60000
const STRIKE_LIMIT = 3
const FLOOD_WINDOW_MS = 10000
const FLOOD_MAX = 3           // same normalized text >=3 times in 10s (global) -> mute (lets "gg" x2 through)

const ipState = new Map()     // ip   -> { times:[], strikes, strikeStart, bannedUntil }
const floodTimes = new Map()  // normalized text -> number[]

function strike(st, now) {
  if (now - (st.strikeStart || 0) > STRIKE_WINDOW_MS) { st.strikes = 1; st.strikeStart = now }
  else st.strikes = (st.strikes || 0) + 1
  if (st.strikes >= STRIKE_LIMIT) st.bannedUntil = now + BAN_MS
}

/**
 * Should this chat frame be broadcast? false = drop SILENTLY (mute).
 * `conn` is a small per-ws object (ws._chat) for the 1s cooldown + 60s no-repeat.
 */
export function chatAllowed({ ip, conn, nick, text, now = Date.now() }) {
  ip = ip || 'unknown'
  let st = ipState.get(ip)
  if (!st) { st = { times: [], strikes: 0, strikeStart: now, bannedUntil: 0 }; ipState.set(ip, st) }

  // 5-min strike ban still active -> mute
  if (st.bannedUntil && st.bannedUntil > now) return false

  // RULE: 1s cooldown per connection
  if (conn) {
    if (conn.lastAt && now - conn.lastAt < COOLDOWN_MS) return false
    // RULE: repeated phrase -> mute (same exact text from this connection within 60s)
    if (conn.lastMsg === text && now - (conn.lastAt || 0) < NOREPEAT_MS) return false
  }

  const nm = norm(text)

  // RULE: hard slur OR authority-impersonation nick -> strike + mute
  if (SLUR.test(nm) || SLUR.test(norm(nick)) || isImpersonationNick(nick)) { strike(st, now); return false }

  // per-IP rate-limit
  st.times = st.times.filter((t) => now - t < IP_WINDOW_MS)
  if (st.times.length >= IP_MAX) { strike(st, now); return false }

  // RULE: global same-text flood (rotated nicks repeating the same line / repeated chars) -> mute
  let ft = (floodTimes.get(nm) || []).filter((t) => now - t < FLOOD_WINDOW_MS)
  if (ft.length >= FLOOD_MAX) { ft.push(now); floodTimes.set(nm, ft); strike(st, now); return false }

  // accepted — record state
  st.times.push(now)
  ft.push(now); floodTimes.set(nm, ft)
  if (conn) { conn.lastAt = now; conn.lastMsg = text }
  return true
}

// periodic cleanup so RAM doesn't grow unbounded (single-machine relay)
const sweep = setInterval(() => {
  const now = Date.now()
  for (const [ip, st] of ipState) {
    const idle = !st.times.length || now - st.times[st.times.length - 1] > 600000
    if (idle && (!st.bannedUntil || st.bannedUntil < now)) ipState.delete(ip)
  }
  for (const [k, arr] of floodTimes) {
    const f = arr.filter((t) => now - t < FLOOD_WINDOW_MS)
    if (f.length) floodTimes.set(k, f); else floodTimes.delete(k)
  }
}, 60000)
sweep.unref?.()

export { SLUR }
