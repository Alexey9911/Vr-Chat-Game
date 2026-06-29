// Authority-IMPERSONATION detection by nick (admin/dev/staff/mod/owner…).
// Single source of truth for the 3 paths: chatGuard (send), index.js (IP ban)
// and chatModeration (sweep of already-posted). SILENT: the impersonator never
// gets feedback (otherwise they'd just tweak the nick and slip back in).
// Ported verbatim from football-Game-Copy-V2/server/impersonation.js.
//
// Deliberately AGGRESSIVE trade-off: an odd nick like "Madmind" (contains "admin")
// may trip — preferable to letting a "House Admin" / "the real dev" through. The
// cost of a false positive is a 1-minute ban, which self-recovers.
//
// Anti-bypass: BEFORE normalizing we fold Unicode (NFKC) + confusables (cyrillic,
// greek, small-caps) so "ＡＤＭＩＮ", "аdmіn", "𝐝𝐞𝐯" can't sneak in via look-alike glyphs.

// per-WALLET allowlist — empty by default. Add a wallet here or via CHAT_ADMIN_WALLETS
// (csv) and that wallet is exempt from the filter.
const ADMIN_WALLETS = new Set(
  (process.env.CHAT_ADMIN_WALLETS || '').split(',').map((s) => s.trim()).filter(Boolean),
)

const LEET = { 1: 'i', '!': 'i', '|': 'i', 3: 'e', 0: 'o', 4: 'a', 7: 't', $: 's', 5: 's', '@': 'a', 6: 'g' }

// non-ASCII glyphs that LOOK like a latin letter (what NFKC won't fold: cyrillic,
// greek, small-caps / modifier letters, dotless i). key→visible latin letter.
const CONFUSABLE = {
  // cyrillic
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j',
  'ѕ': 's', 'ԁ': 'd', 'һ': 'h', 'в': 'b', 'м': 'm', 'т': 't', 'к': 'k', 'н': 'h',
  // greek
  'α': 'a', 'ε': 'e', 'ο': 'o', 'ρ': 'p', 'ν': 'v', 'υ': 'u', 'τ': 't', 'ι': 'i', 'κ': 'k',
  'μ': 'm', 'σ': 's', 'β': 'b',
  // small caps / modifier letters
  'ꜱ': 's', 'ᴏ': 'o', 'ʟ': 'l', 'ʙ': 'b', 'ᴀ': 'a', 'ᴅ': 'd', 'ᴍ': 'm', 'ɴ': 'n', 'ᴇ': 'e',
  'ᴠ': 'v', 'ꜰ': 'f', 'ᴛ': 't', 'ʀ': 'r', 'ᴜ': 'u', 'ᴘ': 'p', 'ᴄ': 'c', 'ɪ': 'i', 'ʏ': 'y',
  'ᴋ': 'k', 'ɢ': 'g', 'ʜ': 'h', 'ᴊ': 'j', 'ᴡ': 'w',
  // dotless i and common accented vowels
  'ı': 'i', 'ï': 'i', 'í': 'i', 'ì': 'i', 'à': 'a', 'á': 'a', 'ó': 'o', 'é': 'e',
}

export function leetNorm(s) {
  let t = String(s || '').normalize('NFKC').toLowerCase()  // NFKC: fullwidth, math-bold, etc.
  t = t.replace(/[^\x00-\x7f]/g, (c) => (c in CONFUSABLE ? CONFUSABLE[c] : c)) // confusables → latin
  t = t.replace(/[1!|3047$5@6]/g, (c) => LEET[c] || '')     // leet → letter
  return t
}
// "tight" norm: letters only (to find brands as substring, e.g. "houseadmin")
export function tightNorm(s) {
  return leetNorm(s).replace(/[^a-z]/g, '')
}

// BRANDS/roles that almost never appear INSIDE a legit nick → substring match
const BRAND_SUBSTR = ['admin', 'administrator', 'administrador', 'moderator', 'official']
// short/ambiguous roles → ONLY as a separate token (won't break "devon", "model").
const ROLE_TOKENS = new Set([
  'dev', 'devs', 'developer', 'mod', 'mods', 'staff', 'owner', 'founder', 'support', 'system',
])

// does this nick try to pass as dev/admin/staff/authority?
export function isImpersonationNick(nick) {
  const tight = tightNorm(nick)
  if (!tight) return false
  for (const b of BRAND_SUBSTR) if (tight.includes(b)) return true
  const tokens = leetNorm(nick).split(/[^a-z]+/).filter(Boolean)
  for (const t of tokens) if (ROLE_TOKENS.has(t)) return true
  return false
}

// wallet in the allowlist → the "special" nick is allowed (filter not applied)
export function isAdminWallet(wallet) {
  return !!wallet && ADMIN_WALLETS.has(wallet)
}
