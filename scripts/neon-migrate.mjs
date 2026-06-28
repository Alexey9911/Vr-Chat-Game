// One-off Neon schema migration for alonHouse. Run: `DATABASE_URL=... node scripts/neon-migrate.mjs`
// Idempotent (CREATE IF NOT EXISTS). Single big lobby → the only persisted data is chat history (+ optional
// profiles). Replaces the old external Deno KV.
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id           TEXT PRIMARY KEY,
    lobby        TEXT NOT NULL DEFAULT 'main',
    player_id    TEXT NOT NULL,
    player_name  TEXT NOT NULL,
    player_color TEXT,
    text         TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ts_ms        BIGINT NOT NULL
  )
`;
await sql`CREATE INDEX IF NOT EXISTS idx_chat_lobby_ts ON chat_messages (lobby, ts_ms DESC)`;

await sql`
  CREATE TABLE IF NOT EXISTS players (
    id           TEXT PRIMARY KEY,
    nick         TEXT NOT NULL,
    color        TEXT,
    skin_id      TEXT,
    colors       JSONB,
    is_admin     BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`;
console.log('OK tables:', tables.map((t) => t.table_name).join(', '));
