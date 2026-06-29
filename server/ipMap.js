// player_id -> client IP map, maintained by index.js on every ACCEPTED chat frame.
// chat_messages (Neon) has no ip column, so the AI moderator / impersonation sweep
// resolves a message's IP through this map to issue 1-minute bans. RAM-only (single
// relay machine — `fly scale count 1`), lost on restart (acceptable: the author is gone).
const ipByPlayer = new Map()

export function setIpForPlayer(id, ip) {
  if (id && ip && ip !== 'unknown') ipByPlayer.set(id, ip)
}
export function getIpForPlayer(id) {
  return ipByPlayer.get(id) || null
}
export function dropPlayer(id) {
  if (id) ipByPlayer.delete(id)
}
