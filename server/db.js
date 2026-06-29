// Neon access for the AI moderator (replaces football's Supabase storage.js).
// chat_messages columns: id(TEXT) | lobby | player_id | player_name | player_color | text | ts_ms
// NOTE: id is the TEXT `${ts}-${playerId}`, so we poll by ts_ms (not a numeric id).
import { neon } from '@neondatabase/serverless'

const LOBBY = process.env.CHAT_LOBBY || 'alonverse' // matches GECKOS_LOBBY on the client
let sql = null

export function hasDb() { return !!process.env.DATABASE_URL }
function db() { if (!sql) sql = neon(process.env.DATABASE_URL); return sql }

// new messages strictly after a ts_ms cursor (ascending). LLM payload uses {id, nick, text}.
export async function fetchNewChat(afterTsMs, limit = 25) {
  return db()`
    SELECT id, player_id, player_name AS nick, text AS msg, ts_ms
    FROM chat_messages
    WHERE lobby = ${LOBBY} AND ts_ms > ${afterTsMs}
    ORDER BY ts_ms ASC
    LIMIT ${limit}`
}
// most-recent N (backlog scan + deterministic impersonation sweep)
export async function fetchRecentChat(limit = 200) {
  return db()`
    SELECT id, player_id, player_name AS nick, text AS msg, ts_ms
    FROM chat_messages
    WHERE lobby = ${LOBBY}
    ORDER BY ts_ms DESC
    LIMIT ${limit}`
}
export async function deleteChat(ids) {
  if (!ids || !ids.length) return
  await db()`DELETE FROM chat_messages WHERE id = ANY(${ids})`
}
