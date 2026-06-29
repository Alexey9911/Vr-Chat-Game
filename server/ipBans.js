// RAM-only timed IP bans (football ipBans.js minus the Supabase mirror — alonHouse
// has no ban table and the relay is a single machine, so RAM is the source of truth).
// Default 60s: a false positive costs only 1 minute and self-recovers.
const DEFAULT_BAN_SEC = 60
const ramBans = new Map() // ip -> untilMs

export function isIpBanned(ip, now = Date.now()) {
  if (!ip || ip === 'unknown') return false
  const until = ramBans.get(ip)
  if (!until) return false
  if (until <= now) { ramBans.delete(ip); return false }
  return true
}
export function banIp(ip, seconds = DEFAULT_BAN_SEC, _reason = '') {
  if (!ip || ip === 'unknown') return
  const until = Date.now() + seconds * 1000
  if (until > (ramBans.get(ip) || 0)) ramBans.set(ip, until)
}
export function banIps(ips, seconds = DEFAULT_BAN_SEC, reason = '') {
  for (const ip of ips || []) banIp(ip, seconds, reason)
}
