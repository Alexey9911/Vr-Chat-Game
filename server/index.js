// alonhouse-realtime — a plain WebSocket (TCP) relay hub for alonHouse's SINGLE-lobby multiplayer presence.
// Fans out transform updates + chat + generic app events + voice to all peers. PAYLOAD-AGNOSTIC for pos/evt/vframe;
// CHAT is the one moderated chokepoint (anti-spam + anti-hate + anti-impersonation). One big lobby = one global
// broadcast; keep exactly ONE machine (peer + moderation state is in-process) — `fly scale count 1`.
//
// WHY WebSockets instead of geckos.io (WebRTC/UDP): geckos needs an ICE/STUN handshake to open a UDP DataChannel,
// but fly.io NATs this machine's UDP EGRESS through a SHARED IP that differs from its dedicated INGRESS IPv4, so
// the relay could only ever advertise its internal `172.x` ICE candidate and browsers silently failed ICE — live
// presence/chat never worked. WebSockets are TCP: they traverse any NAT. Persistence (chat history) lives in Neon
// via the Next.js API routes; the AI moderator (server/chatModeration.js) reads/deletes that same Neon table.
//
// Wire format: JSON `{ e: <event>, d: <data> }` frames.
//   hello  {id,nick}            — client→server handshake (registers id + nick)
//   pos    PlayerState          — broadcast to everyone but the sender
//   chat   ChatWire             — MODERATED, then broadcast to everyone but the sender
//   evt    AppEvent             — broadcast (music sync / admin kick / chatRemoved)
//   vframe VoiceFrame           — broadcast
//   voice  {from,to,signal}     — addressed to ONE peer (WebRTC mesh voice signaling)
//   leave  {id}                 — server→clients, on disconnect
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { isImpersonationNick } from './impersonation.js';
import { chatAllowed } from './chatGuard.js';
import { isIpBanned, banIp } from './ipBans.js';
import { setIpForPlayer, dropPlayer } from './ipMap.js';
import { startChatModeration } from './chatModeration.js';

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const ADMIN_PREFIX = /^\[admin\]\s*/i; // alonHouse authenticated-admin display prefix — exempt from the nick filter

// id <-> socket maps, for addressed voice routing + leave notices.
const byId = new Map(); // playerId -> ws
const idByWs = new Map(); // ws -> playerId

// Resolve the real client IP from the upgrade request (fly.io sets x-forwarded-for; take the first hop).
function clientIp(req) {
  const xff = req && req.headers && req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return (req && req.socket && req.socket.remoteAddress) || 'unknown';
}

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

// Broadcast to EVERYONE (used by the AI moderator's live chatRemoved notice).
function broadcastAll(obj) {
  const raw = JSON.stringify(obj);
  for (const c of wss.clients) {
    if (c.readyState === 1) {
      try {
        c.send(raw);
      } catch {
        /* drop */
      }
    }
  }
}

wss.on('connection', (ws, req) => {
  ws._ip = clientIp(req);
  ws._chat = { lastAt: 0, lastMsg: '' }; // per-connection state for chatGuard (1s cooldown + no-repeat)
  ws._nick = '';

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
      ws._nick = String((f.d && f.d.nick) || '');
      if (id) {
        idByWs.set(ws, id);
        byId.set(id, ws);
        if (ws._ip) setIpForPlayer(id, ws._ip);
      }

      return;
    }

    // CHAT — the single authoritative moderation chokepoint (un-bypassable for live broadcast).
    if (e === 'chat') {
      const d = (f && f.d) || {};
      const now = Date.now();
      const ip = ws._ip;
      // 1) active IP ban (1 min) → silent drop
      if (isIpBanned(ip, now)) return;
      const rawNick = String(d.playerName || ws._nick || '');
      const nick = rawNick.replace(ADMIN_PREFIX, ''); // don't punish authenticated [ADMIN] players
      const text = String(d.text || '').slice(0, 200).trim();
      if (!text) return;
      // 2) authority-impersonation nick → 1-min IP ban + drop (silent)
      if (isImpersonationNick(nick)) { banIp(ip, 60, 'impersonation'); return; }
      // 3) deterministic anti-spam: 1s cooldown, no-repeat, slur, per-IP rate, global flood, 3-strike→5min
      if (!chatAllowed({ ip, conn: ws._chat, nick, text, now })) return;
      // accepted: remember author IP (so the AI/sweep can ban from a Neon row), then fan out verbatim
      if (d.playerId) setIpForPlayer(d.playerId, ip);
      broadcastExcept(ws, raw);

      return;
    }

    // Fan-out events — everyone except the sender.
    if (e === 'pos' || e === 'evt' || e === 'vframe') {
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
      dropPlayer(id);
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
  // AI + deterministic impersonation moderation of the Neon-persisted chat. Live removals are
  // broadcast as an `evt` so every client drops the message without a reload.
  startChatModeration({
    onRemoved: (ids) => broadcastAll({ e: 'evt', d: { t: 'chatRemoved', ids } }),
  });
});
