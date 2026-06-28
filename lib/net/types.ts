// The geckos wire contract for alonHouse multiplayer — the single source of truth for what crosses the relay.
// It REPLACES Playroom's per-player KV bag. Faithful to GTA-PORT's Presence model (so the port is minimal), but
// adapted to alonHouse: Y-up R3F coords, `rotationY`/`animation` (not GTA's `facing`/`clip`), no vehicles, plus
// alonHouse's profile fields. Keep these aligned with `RemotePlayer` in lib/multiplayerStore.ts so the renderer
// and every consumer stay UNCHANGED.

/**
 * The per-player broadcast payload (the geckos `pos` event), sent at up to SEND_HZ with idle-dedupe.
 * It carries the high-rate transform PLUS the mostly-static profile fields — the dedupe means profile fields
 * only re-send when they actually change (or on the keepalive / new-peer re-announce), which is also how a late
 * joiner hydrates a remote's name/skin/colours WITHOUT Playroom's KV replay. `chatMessage` is NOT here — chat
 * bubbles ride the separate `chat` event (see {@link ChatWire}).
 */
export interface PlayerState {
  /** Stable session id (minted by Presence: `${nick.slice(0,12)}#${rand}`). */
  id: string;
  /** Position (Y-up, R3F world units). */
  x: number;
  y: number;
  z: number;
  /** Facing about the world up-axis (radians). */
  rotationY: number;
  /** Current animation clip name, or null. */
  animation: null | string;
  // --- profile / identity (rarely changes → deduped, doesn't re-send every tick) ---
  name: string;
  color: string;
  skinId?: string;
  isAdmin?: boolean;
  colors?: { accent?: string; primary?: string; secondary?: string };
  isMusicPlaying?: boolean;
  isYouTubePlaying?: boolean;
  youtubeVideoId?: string;
  isMicActive?: boolean;
}

/** A remote player as tracked by Presence: the latest broadcast + when we last heard from them (for prune). */
export type RemotePeer = PlayerState & { lastSeen: number };

/** What Presence samples from the LOCAL player each tick (everything in PlayerState except the id). */
export type StateGetter = () => Omit<PlayerState, 'id'>;

/**
 * A chat bubble broadcast (the geckos `chat` event). Mirrors `ChatMessage` in lib/multiplayerStore.ts so the
 * existing chat UI/store stay unchanged. Persistence (history) lives in Neon, not here.
 */
export interface ChatWire {
  /** `${timestamp}-${playerId}` — deterministic, used for dedupe. */
  id: string;
  playerId: string;
  playerName: string;
  playerColor?: string;
  text: string;
  timestamp: number;
}

/**
 * A generic RELIABLE app event (the geckos `evt` channel) — replaces Playroom's `RPC.Mode.ALL` broadcasts that
 * are NOT part of per-player state: synchronized music play/stop and the admin kick. `t` discriminates the type.
 */
export type AppEvent =
  | { t: 'music'; id: string; action: 'play' | 'stop'; data?: unknown }
  | { t: 'kick'; id: string };

/**
 * A voice PCM frame (the geckos `vframe` event, UNRELIABLE — like `pos`). Base64 of a 16 kHz mono Int16 frame +
 * the sender's id and position so the receiver can apply proximity gain (no WebRTC mesh, no TURN).
 */
export interface VoiceFrame {
  id: string;
  /** Monotonic frame sequence (for the receiver's jitter buffer). */
  seq: number;
  /** Base64-encoded Int16 PCM frame. */
  pcm: string;
  x: number;
  y: number;
  z: number;
}
