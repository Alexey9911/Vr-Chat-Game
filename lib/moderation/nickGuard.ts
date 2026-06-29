// TS twin of server/impersonation.js + the slur regex, shared by the client (LobbyScreen
// nickname block) and the Next.js persistence backstop (pages/api/messages.ts). Keep this
// logic byte-aligned with server/impersonation.js + server/chatGuard.js — the relay is the
// authoritative layer; these are UX + persistence backstops.

const LEET: Record<string, string> = { 1: 'i', '!': 'i', '|': 'i', 3: 'e', 0: 'o', 4: 'a', 7: 't', $: 's', 5: 's', '@': 'a', 6: 'g' }

const CONFUSABLE: Record<string, string> = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j',
  'ѕ': 's', 'ԁ': 'd', 'һ': 'h', 'в': 'b', 'м': 'm', 'т': 't', 'к': 'k', 'н': 'h',
  'α': 'a', 'ε': 'e', 'ο': 'o', 'ρ': 'p', 'ν': 'v', 'υ': 'u', 'τ': 't', 'ι': 'i', 'κ': 'k',
  'μ': 'm', 'σ': 's', 'β': 'b',
  'ꜱ': 's', 'ᴏ': 'o', 'ʟ': 'l', 'ʙ': 'b', 'ᴀ': 'a', 'ᴅ': 'd', 'ᴍ': 'm', 'ɴ': 'n', 'ᴇ': 'e',
  'ᴠ': 'v', 'ꜰ': 'f', 'ᴛ': 't', 'ʀ': 'r', 'ᴜ': 'u', 'ᴘ': 'p', 'ᴄ': 'c', 'ɪ': 'i', 'ʏ': 'y',
  'ᴋ': 'k', 'ɢ': 'g', 'ʜ': 'h', 'ᴊ': 'j', 'ᴡ': 'w',
  'ı': 'i', 'ï': 'i', 'í': 'i', 'ì': 'i', 'à': 'a', 'á': 'a', 'ó': 'o', 'é': 'e',
}

const ADMIN_PREFIX = /^\[admin\]\s*/i // authenticated-admin display prefix — exempt

function leetNorm(s: string): string {
  let t = String(s || '').normalize('NFKC').toLowerCase()
  t = t.replace(/[^\x00-\x7f]/g, (c) => (c in CONFUSABLE ? CONFUSABLE[c] : c))
  t = t.replace(/[1!|3047$5@6]/g, (c) => LEET[c] || '')
  return t
}
function tightNorm(s: string): string {
  return leetNorm(s).replace(/[^a-z]/g, '')
}

const BRAND_SUBSTR = ['admin', 'administrator', 'administrador', 'moderator', 'official']
const ROLE_TOKENS = new Set(['dev', 'devs', 'developer', 'mod', 'mods', 'staff', 'owner', 'founder', 'support', 'system'])

export const SLUR = /(nigg|niggr|faggot|fagg|kike|chink|spic|retard)/

/** Does this nick try to pass as dev/admin/staff/authority? (strips the legit [ADMIN] prefix first) */
export function isImpersonationNick(nick: string): boolean {
  const cleaned = String(nick || '').replace(ADMIN_PREFIX, '')
  const tight = tightNorm(cleaned)
  if (!tight) return false
  for (const b of BRAND_SUBSTR) if (tight.includes(b)) return true
  const tokens = leetNorm(cleaned).split(/[^a-z]+/).filter(Boolean)
  for (const t of tokens) if (ROLE_TOKENS.has(t)) return true
  return false
}
