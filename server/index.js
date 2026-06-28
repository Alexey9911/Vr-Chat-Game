// alonhouse-realtime — a geckos.io (WebRTC/UDP) relay hub for alonHouse's SINGLE-lobby multiplayer presence.
// Fans out transform updates + chat + generic app events + voice PCM frames to all peers. It is fully
// PAYLOAD-AGNOSTIC: the relay never inspects the game-state shape, so the client owns the wire format. One big
// lobby = one global channel; keep exactly ONE machine (`fly scale count 1`) — peer state is in-process.
//
// Ported from GTA-PORT's `gtasa-realtime`, with the Supabase bridge REMOVED: alonHouse is geckos-only (no
// fallback transport). If Supabase/Neon parity is ever wanted, persistence lives in Next.js API routes, not here.
//
// Deployed on fly.io. UDP needs a DEDICATED IPv4 + the `fly-global-services` bind (see fly.toml).
import geckos, { iceServers as defaultIceServers } from '@geckos.io/server';
import dns from 'node:dns';
import http from 'node:http';

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const UDP_PORT = Number.parseInt(process.env.GECKOS_UDP_PORT || '20000', 10);

// id <-> channel maps, for addressed voice routing (Option A signaling) + leave notices.
const idByChannel = new Map(); // channel.id -> playerId
const channelById = new Map(); // playerId  -> channel

// Health endpoint (+ geckos signaling attaches to this same HTTP server).
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, players: channelById.size, udp: UDP_PORT }));

    return;
  }
  res.writeHead(404);
  res.end();
});

// Fly.io delivers inbound UDP ONLY when bound to the fly-global-services address (resolved to an IPv4).
let bindAddress;
if (process.env.GECKOS_BIND) {
  try {
    bindAddress = (await dns.promises.lookup(process.env.GECKOS_BIND, { family: 4 })).address;
    console.log(`[geckos] UDP bind ${process.env.GECKOS_BIND} -> ${bindAddress}`);
  } catch (error) {
    console.warn('[geckos] bind lookup failed:', error?.message);
  }
}

// Optional TURN/ICE override (recommended for NAT coverage since there is no fallback transport): set
// GECKOS_ICE to a JSON array of RTCIceServer entries.
let iceServers = defaultIceServers || [];
if (process.env.GECKOS_ICE) {
  try {
    iceServers = JSON.parse(process.env.GECKOS_ICE);
  } catch {
    /* keep defaults */
  }
}

const io = geckos({
  cors: { allowAuthorization: true, origin: '*' },
  iceServers,
  portRange: { max: UDP_PORT, min: UDP_PORT },
  ...(bindAddress ? { bindAddress } : {}),
});
io.addServer(server);

io.onConnection((channel) => {
  // Identify the player (so we can route addressed voice + announce leaves).
  channel.on('hello', (data) => {
    const id = String(data?.id || '');
    if (!id) {
      return;
    }
    idByChannel.set(channel.id, id);
    channelById.set(id, channel);
  });

  // Transform fan-out — UNRELIABLE (UDP), like gameplay; everyone except the sender.
  channel.on('pos', (data) => channel.broadcast.emit('pos', data));

  // Chat bubble fan-out — RELIABLE (a dropped chat line is bad).
  channel.on('chat', (data) => channel.broadcast.emit('chat', data));

  // Generic app-event fan-out — RELIABLE. Carries profile / skin / music / admin broadcasts (the payload has
  // its own `t` type field); this replaces Playroom's RPC.Mode.ALL broadcasts. Relay stays payload-agnostic.
  channel.on('evt', (data) => channel.broadcast.emit('evt', data));

  // Voice PCM frames — UNRELIABLE broadcast (like pos). Proximity gain is applied client-side on receive, so a
  // single relay fan-out scales to a big lobby without a WebRTC mesh ("if pos gets through, voice does too").
  channel.on('vframe', (data) => channel.broadcast.emit('vframe', data));

  // Addressed WebRTC voice signaling (Option A, optional) — RELIABLE, only to the named peer (SDP/ICE).
  channel.on('voice', (data) => {
    const target = channelById.get(String(data?.to || ''));
    if (target) {
      target.emit('voice', data, { reliable: true });
    }
  });

  channel.onDisconnect(() => {
    const id = idByChannel.get(channel.id);
    if (id) {
      idByChannel.delete(channel.id);
      channelById.delete(id);
      channel.broadcast.emit('leave', { id });
    }
  });
});

server.listen(PORT, () => {
  console.log(`[alonhouse-realtime] http :${PORT} · udp :${UDP_PORT} · bind ${bindAddress || 'default'}`);
});
