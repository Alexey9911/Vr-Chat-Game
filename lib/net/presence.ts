import type { RealtimeTransport, TransportHandlers } from './realtime-transport';
import type { AppEvent, ChatWire, PlayerState, RemotePeer, StateGetter, VoiceFrame, VoiceSignal } from './types';

import { createTransport } from './realtime-transport';
import { distance3D, falloff, type Vec3Like } from './spatial';

// Geckos is cheap, so push at a smooth 15 Hz; idle-dedupe + the distance throttle keep the actual traffic low.
const SEND_HZ = 15;
/** Re-broadcast at least this often even when idle, so a standing player isn't pruned by others (their prune is 4 s). */
const IDLE_KEEPALIVE_MS = 2000;
/** For the first moments after joining, broadcast EVERY tick so a fresh joiner is seen + everyone re-announces back. */
const JOIN_BURST_MS = 3000;

// Distance-tiered broadcast rate — "close = fluid, far = barely updates". RETUNED for alonHouse's small map
// (~248×229 u, Y-up R3F), MUCH tighter than GTA's 40/220 (a ~280 u world): full SEND_HZ within
// NET_FULL_RATE_RADIUS, ramping down (same linear `falloff` curve as the proximity audio) to NET_FLOOR_HZ once
// the nearest other player is NET_FADE_RATE_RADIUS away (≈ across the house — a small far figure). With GTA's
// radii every player would sit in the full-rate zone and the throttle would never engage. Single place to retune.
export const NET_FULL_RATE_RADIUS = 18;
export const NET_FADE_RATE_RADIUS = 130;
export const NET_FLOOR_HZ = 4;

/** Pure: the broadcast rate (Hz) for a player whose nearest neighbour is `nearestDistance` away — `fullHz` within
 *  {@link NET_FULL_RATE_RADIUS}, ramping to {@link NET_FLOOR_HZ} at {@link NET_FADE_RATE_RADIUS} (and for `Infinity`). */
export function broadcastHzForDistance(nearestDistance: number, fullHz: number): number {
  const f = falloff(nearestDistance, NET_FADE_RATE_RADIUS, 1, NET_FULL_RATE_RADIUS);

  return NET_FLOOR_HZ + (fullHz - NET_FLOOR_HZ) * f;
}

/** Pure: distance to the closest of `remotes` from `self` (Infinity when there are none). Takes a Map (not a
 *  bare iterable) so it iterates via `.forEach` — clean under the project's es5 tsc target. */
export function nearestRemoteDistance(self: Vec3Like, remotes: ReadonlyMap<string, Vec3Like>): number {
  let min = Infinity;
  remotes.forEach((r) => {
    const d = distance3D(self, r);
    if (d < min) {
      min = d;
    }
  });

  return min;
}

/**
 * Multiplayer presence + position sync for alonHouse's SINGLE big lobby — the geckos replacement for Playroom's
 * per-player KV. Broadcasts the local player (transform + profile) with idle-dedupe + a distance-tiered rate +
 * a join burst, and collects everyone else into {@link remote}. New-peer re-announce (a late joiner hears an
 * unknown id → everyone force-rebroadcasts next tick) replays transient state without Playroom's KV; profile
 * fields ride the deduped `pos`, so a late joiner gets names/skins within ~one interval. Chat bubbles + generic
 * app events + voice PCM frames ride the same channel via the {@link RealtimeTransport}.
 */
export class Presence {
  readonly remote = new Map<string, RemotePeer>();

  get myId(): string {
    return this.id;
  }
  private forceBroadcast = false;
  private readonly getState: StateGetter;
  private id = '';
  private joinedAt = 0;
  private lastSentAt = 0;
  private lastSentKey: null | string = null;
  private movingLastTick = false;
  private nick = '';
  private onChatCb: ((chat: ChatWire) => void) | null = null;
  private onEvtCb: ((evt: AppEvent) => void) | null = null;
  private onVoiceCb: ((from: string, signal: VoiceSignal) => void) | null = null;
  private onVoiceFrameCb: ((frame: VoiceFrame) => void) | null = null;
  private timer: null | number = null;
  private readonly transport: RealtimeTransport;

  /** `transport` defaults to the env-selected geckos backend; injectable for unit tests. */
  constructor(getState: StateGetter, transport: RealtimeTransport = createTransport()) {
    this.getState = getState;
    this.transport = transport;
  }

  join(nick: string): void {
    this.nick = nick;
    this.id = `${nick.slice(0, 12)}#${Math.random().toString(36).slice(2, 7)}`;
    this.transport.connect(this.id, this.nick, {
      onChat: (chat) => {
        if (chat.playerId !== this.id) {
          this.onChatCb?.(chat);
        }
      },
      onEvt: (evt) => {
        if (evt.id !== this.id) {
          this.onEvtCb?.(evt);
        }
      },
      onLeave: (id) => {
        this.remote.delete(id);
      },
      onPos: (p) => {
        if (p.id !== this.id) {
          // First time we hear from this player → re-announce OURSELVES next tick (clear the dedupe key + bypass
          // the distance throttle once) so the newcomer sees us + our profile right away. geckos has no KV replay.
          if (!this.remote.has(p.id)) {
            this.lastSentKey = null;
            this.forceBroadcast = true;
          }
          this.remote.set(p.id, { ...p, lastSeen: performance.now() });
        }
      },
      onVoice: (from, signal) => {
        if (from !== this.id) {
          this.onVoiceCb?.(from, signal);
        }
      },
      onVoiceFrame: (frame) => {
        if (frame.id !== this.id) {
          this.onVoiceFrameCb?.(frame);
        }
      },
    });
    this.joinedAt = performance.now();
    this.timer = window.setInterval(() => this.broadcast(), 1000 / SEND_HZ);
    this.broadcast(); // announce immediately
  }

  leave(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.transport.disconnect();
    this.remote.clear();
  }

  /** Register the handler for incoming chat bubbles from other players. */
  onChat(cb: (chat: ChatWire) => void): void {
    this.onChatCb = cb;
  }

  /** Register the handler for incoming generic app events (music play/stop, admin kick) from other players. */
  onEvt(cb: (evt: AppEvent) => void): void {
    this.onEvtCb = cb;
  }

  /** Register the handler for incoming WebRTC voice signaling (SDP/ICE) addressed to us. */
  onVoice(cb: (from: string, signal: VoiceSignal) => void): void {
    this.onVoiceCb = cb;
  }

  /** Register the handler for incoming voice PCM frames from other players. */
  onVoiceFrame(cb: (frame: VoiceFrame) => void): void {
    this.onVoiceFrameCb = cb;
  }

  /** Drop remote players whose last broadcast is older than `maxAgeMs` (a refresh/crash that skipped `leave`). */
  prune(maxAgeMs = 4000): void {
    const now = performance.now();
    const stale: string[] = [];
    this.remote.forEach((p, id) => {
      if (now - p.lastSeen > maxAgeMs) {
        stale.push(id);
      }
    });
    for (const id of stale) {
      this.remote.delete(id);
    }
  }

  /** Broadcast a chat bubble (the local UI also adds it optimistically + persists to Neon separately). */
  sendChat(chat: ChatWire): void {
    this.transport.sendChat(chat);
  }

  /** Broadcast a generic app event (synchronized music, admin kick) to everyone. */
  sendEvt(evt: AppEvent): void {
    this.transport.sendEvt(evt);
  }

  /** Send a WebRTC voice signaling message (SDP/ICE) to ONE peer (the mesh handshake, ported from GTA-PORT). */
  sendVoice(to: string, signal: VoiceSignal): void {
    this.transport.sendVoice(this.id, to, signal);
  }

  /** Broadcast a voice PCM frame to everyone (proximity gain is applied per-listener on receive). */
  sendVoiceFrame(frame: VoiceFrame): void {
    this.transport.sendVoiceFrame(frame);
  }

  private broadcast(): void {
    const s = this.getState();
    // Dedupe fingerprint: transform (quantized) + the profile fields, so a move OR a skin/colour/flag change
    // forces a re-send, while standing still + unchanged profile idle-skips down to the keepalive.
    const c = s.colors ? `${s.colors.primary ?? ''}|${s.colors.secondary ?? ''}|${s.colors.accent ?? ''}` : '';
    const prof =
      `${s.name}|${s.color}|${s.skinId ?? ''}|${s.isAdmin ? 1 : 0}|${c}|` +
      `${s.isMusicPlaying ? 1 : 0}|${s.isYouTubePlaying ? 1 : 0}|${s.youtubeVideoId ?? ''}|${s.mediaStartEpoch ?? ''}|${s.isMicActive ? 1 : 0}`;
    const key = `${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)},${s.rotationY.toFixed(3)},${s.animation ?? ''},${prof}`;
    const now = performance.now();
    const inJoinBurst = now - this.joinedAt < JOIN_BURST_MS;
    const force = this.forceBroadcast;
    this.forceBroadcast = false;
    const moving = key !== this.lastSentKey;
    const wasMoving = this.movingLastTick;
    this.movingLastTick = moving;
    if (!inJoinBurst && !force) {
      if (!moving) {
        // Standing still: only the keepalive heartbeat (so a motionless player is never pruned).
        if (now - this.lastSentAt < IDLE_KEEPALIVE_MS) {
          return;
        }
      } else if (wasMoving) {
        // CONTINUED motion: cap the rate by distance to the nearest player — full SEND_HZ up close, ramping to
        // NET_FLOOR_HZ when everyone's across the map. The FIRST frame of motion (onset) bypasses this so a
        // far/lone player who was idle doesn't "stick" for up to a floor interval before moving.
        const hz = broadcastHzForDistance(nearestRemoteDistance(s, this.remote), SEND_HZ);
        if (now - this.lastSentAt < 1000 / hz) {
          return;
        }
      }
    }
    this.lastSentKey = key;
    this.lastSentAt = now;
    this.transport.sendPos({ id: this.id, ...s });
  }
}
