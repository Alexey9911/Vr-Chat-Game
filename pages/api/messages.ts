import type { NextApiRequest, NextApiResponse } from 'next';

import { getSql } from '../../lib/db/neon';

// Neon-backed chat history for the single lobby (replaces the old external Deno KV). GET ?lobby=main returns the
// latest messages oldest→newest; POST { lobby, message } appends one (idempotent on id). Named `/api/messages`
// to avoid the existing `/api/chat` (AI assistant) route.
const HISTORY_LIMIT = 50;

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    const sql = getSql();

    if (req.method === 'GET') {
      const lobby = String(req.query.lobby || 'main');
      const rows = (await sql`
        SELECT id, player_id, player_name, player_color, text, ts_ms
        FROM chat_messages
        WHERE lobby = ${lobby}
        ORDER BY ts_ms DESC
        LIMIT ${HISTORY_LIMIT}
      `) as Array<{
        id: string;
        player_color: null | string;
        player_id: string;
        player_name: string;
        text: string;
        ts_ms: number | string;
      }>;
      // Oldest → newest for the UI.
      const messages = rows.reverse().map((r) => ({
        id: r.id,
        playerColor: r.player_color ?? undefined,
        playerId: r.player_id,
        playerName: r.player_name,
        text: r.text,
        timestamp: Number(r.ts_ms),
      }));
      res.status(200).json(messages);

      return;
    }

    if (req.method === 'POST') {
      const { lobby = 'main', message } = (req.body ?? {}) as {
        lobby?: string;
        message?: {
          id?: string;
          playerColor?: string;
          playerId?: string;
          playerName?: string;
          text?: string;
          timestamp?: number;
        };
      };
      if (!message?.id || !message.text || !message.playerId) {
        res.status(400).json({ error: 'bad message' });

        return;
      }
      await sql`
        INSERT INTO chat_messages (id, lobby, player_id, player_name, player_color, text, ts_ms)
        VALUES (${message.id}, ${lobby}, ${message.playerId}, ${message.playerName ?? ''},
                ${message.playerColor ?? null}, ${message.text}, ${message.timestamp ?? Date.now()})
        ON CONFLICT (id) DO NOTHING
      `;
      res.status(200).json({ ok: true });

      return;
    }

    res.status(405).end();
  } catch (error) {
    console.error('[api/messages]', (error as Error)?.message);
    res.status(500).json({ error: 'db error' });
  }
}
