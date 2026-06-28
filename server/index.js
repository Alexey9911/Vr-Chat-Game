// alonhouse-realtime — a plain WebSocket (TCP) relay hub for alonHouse's SINGLE-lobby multiplayer presence.
// Fans out transform updates + chat + generic app events + voice to all peers. PAYLOAD-AGNOSTIC: the relay never
// inspects the game-state shape, the client owns the wire format. One big lobby = one global broadcast; keep
// exactly ONE machine (peer state is in-process) — `fly scale count 1`.
//
// WHY WebSockets instead of geckos.io (WebRTC/UDP): geckos needs an ICE/STUN handshake to open a UDP DataChannel,
// but fly.io NATs this machine's UDP EGRESS through a SHARED IP that differs from its dedicated INGRESS IPv4, so
// the relay could only ever advertise its internal `172.x` ICE candidate and browsers silently failed ICE — live
// presence/chat never worked (only the Neon-persisted chat history loaded). WebSockets are TCP: they traverse any
// NAT, need no ICE/STUN/dedicated-IPv4, and fly's HTTP/TLS service already routes them. Persistence (chat history)
// still lives in Neon via the Next.js API routes, never on this channel.
//
// Wire format: JSON `{ e: <event>, d: <data> }` frames.
//   hello  {id,nick}            — client→server handshake (registers the id for addressed voice + leave notices)
//   pos    PlayerState          — client↔clients, broadcast to everyone but the sender
//   chat   ChatWire             — client↔clients, broadcast
//   evt    AppEvent             — client↔clients, broadcast (music sync / admin kick)
//   vframe VoiceFrame           — client↔clients, broadcast
//   voice  {from,to,signal}     — client→ONE peer (addressed, for the WebRTC mesh voice signaling)
//   leave  {id}                 — server→clients, on disconnect
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number.parseInt(process.env.PORT || '8080', 10);

// id <-> socket maps, for addressed voice routing + leave notices.
const byId = new Map(); // playerId -> ws
const idByWs = new Map(); // ws -> playerId

// Health endpoint (the WebSocket server attaches to this same HTTP server).
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, players: byId.size, transport: 'ws' }));

    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

function broadcastExcept(sender, raw) {
  for (const c of wss.clients) {
    if (c !== sender && c.readyState === 1) {
      try {
        c.send(raw);
      } catch {
        /* drop */
      }
    }
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (buf) => {
    const raw = buf.toString();
    let f;
    try {
      f = JSON.parse(raw);
    } catch {
      return;
    }
    const e = f && f.e;

    if (e === 'hello') {
      const id = String((f.d && f.d.id) || '');
      if (id) {
        idByWs.set(ws, id);
        byId.set(id, ws);
      }

      return;
    }

    // Fan-out events — everyone except the sender.
    if (e === 'pos' || e === 'chat' || e === 'evt' || e === 'vframe') {
      broadcastExcept(ws, raw);

      return;
    }

    // Addressed voice signaling — only to the named peer.
    if (e === 'voice') {
      const to = String((f.d && f.d.to) || '');
      const target = byId.get(to);
      if (target && target.readyState === 1) {
        try {
          target.send(raw);
        } catch {
          /* drop */
        }
      }
    }
  });

  ws.on('close', () => {
    const id = idByWs.get(ws);
    if (id) {
      idByWs.delete(ws);
      byId.delete(id);
      broadcastExcept(ws, JSON.stringify({ e: 'leave', d: { id } }));
    }
  });

  ws.on('error', () => {
    try {
      ws.close();
    } catch {
      /* noop */
    }
  });
});

server.listen(PORT, () => {
  console.log(`[alonhouse-realtime] WebSocket relay listening on :${PORT}`);
});
