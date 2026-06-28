import type { RealtimeTransport, TransportHandlers } from './realtime-transport';
import type { AppEvent, ChatWire, PlayerState, VoiceFrame, VoiceSignal } from './types';

/** How long to wait for the geckos (UDP) channel to connect before giving up. A touch longer than GTA-PORT's
 *  4 s because there is NO fallback here — we'd rather wait for a slow ICE than drop straight to "no multiplayer".
 *  A US client to an iad relay normally completes ICE in ~1-2 s. */
const CONNECT_TIMEOUT_MS = 6000;

/** A geckos channel — the bits we use (the lib's full type is loaded lazily). */
interface Channel {
  close: () => void;
  emit: (event: string, data: unknown, options?: { reliable?: boolean }) => void;
  on: (event: string, cb: (data: unknown) => void) => void;
  onConnect: (cb: (error?: unknown) => void) => void;
}

/**
 * geckos.io (WebRTC/UDP) realtime backend for alonHouse, pointed at the fly.io relay (`server/`). The geckos
 * client is imported LAZILY (browser-only, like Playroom was). There is NO fallback transport — if UDP can't
 * connect within {@link CONNECT_TIMEOUT_MS} (or the env URL is missing/bad), it marks itself failed and logs a
 * clear error (the user simply has no multiplayer that session). Mitigate restrictive-NAT users with a TURN
 * server via the relay's `GECKOS_ICE`.
 */
export class GeckosTransport implements RealtimeTransport {
  private channel: Channel | null = null;
  private handlers: null | TransportHandlers = null;
  private id = '';
  private mode: 'failed' | 'geckos' | 'pending' = 'pending';
  private nick = '';
  private readonly raw: string;
  private timer: null | number = null;

  constructor(raw: string) {
    this.raw = raw;
  }

  connect(id: string, nick: string, handlers: TransportHandlers): void {
    this.id = id;
    this.nick = nick;
    this.handlers = handlers;
    const cfg = parseGeckosUrl(this.raw);
    if (!cfg) {
      this.fail('NEXT_PUBLIC_GECKOS_URL missing/unparseable');

      return;
    }
    this.timer = window.setTimeout(() => this.fail('connect timeout'), CONNECT_TIMEOUT_MS);
    void import('@geckos.io/client')
      .then(({ default: geckos }) => {
        if (this.mode === 'failed') {
          return;
        }
        const channel = geckos({ port: cfg.port, url: cfg.url }) as unknown as Channel;
        this.channel = channel;
        channel.onConnect((error) => {
          if (this.mode === 'failed') {
            channel.close();

            return;
          }
          if (error) {
            this.fail('ICE/connect error');

            return;
          }
          this.mode = 'geckos';
          this.clearTimer();
          channel.emit('hello', { id, nick }, { reliable: true });
          channel.on('pos', (data) => handlers.onPos(data as PlayerState));
          channel.on('chat', (data) => handlers.onChat(data as ChatWire));
          channel.on('evt', (data) => handlers.onEvt(data as AppEvent));
          channel.on('vframe', (data) => handlers.onVoiceFrame(data as VoiceFrame));
          channel.on('voice', (data) => {
            const d = data as { from: string; signal: VoiceSignal; to: string };
            handlers.onVoice(d.from, d.signal);
          });
          channel.on('leave', (data) => handlers.onLeave((data as { id: string }).id));
        });
      })
      .catch(() => this.fail('@geckos.io/client import failed'));
  }

  disconnect(): void {
    this.clearTimer();
    this.channel?.close();
    this.channel = null;
    this.mode = 'pending';
  }

  sendChat(chat: ChatWire): void {
    if (this.mode === 'geckos') {
      this.channel?.emit('chat', chat, { reliable: true });
    }
  }

  sendEvt(evt: AppEvent): void {
    if (this.mode === 'geckos') {
      this.channel?.emit('evt', evt, { reliable: true });
    }
  }

  sendPos(payload: PlayerState): void {
    if (this.mode === 'geckos') {
      this.channel?.emit('pos', payload);
    }
  }

  sendVoice(from: string, to: string, signal: VoiceSignal): void {
    if (this.mode === 'geckos') {
      // Addressed + reliable: the relay (server/index.js `channel.on('voice')`) routes it to the named peer only.
      this.channel?.emit('voice', { from, signal, to }, { reliable: true });
    }
  }

  sendVoiceFrame(frame: VoiceFrame): void {
    if (this.mode === 'geckos') {
      this.channel?.emit('vframe', frame);
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Mark the transport permanently failed for this session (idempotent; never overrides a live connection). */
  private fail(reason: string): void {
    if (this.mode === 'geckos') {
      return;
    }
    this.mode = 'failed';
    this.clearTimer();
    console.error(
      `[geckos] connection failed (${reason}). alonHouse is geckos-only, so multiplayer is unavailable this ` +
        `session. Check NEXT_PUBLIC_GECKOS_URL and that the network allows WebRTC/UDP.`,
    );
  }
}

/** Parse `NEXT_PUBLIC_GECKOS_URL` (e.g. `https://alonhouse-realtime.fly.dev`) into the `{ url, port }` geckos wants. */
export function parseGeckosUrl(raw: string): null | { port: number; url: string } {
  try {
    const u = new URL(raw);
    const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;

    return { port, url: `${u.protocol}//${u.hostname}` };
  } catch {
    return null;
  }
}
