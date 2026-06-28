import type { AppEvent, ChatWire, PlayerState, VoiceFrame, VoiceSignal } from './types';

import { GeckosTransport } from './geckos-transport';

/**
 * The realtime backend for {@link Presence}: position fan-out + chat + generic app events + voice PCM frames +
 * leave events, over the geckos.io/UDP fly.io relay. UNLIKE GTA-PORT (which keeps a Supabase fallback), alonHouse
 * is GECKOS-ONLY — there is exactly one implementation. Persistence (chat history, profiles) lives in Neon via
 * Next.js API routes, never on this channel.
 */
export interface RealtimeTransport {
  connect(id: string, nick: string, handlers: TransportHandlers): void;
  disconnect(): void;
  /** Reliable: a generic app broadcast (synchronized music play/stop, admin kick) — see {@link AppEvent}. */
  sendEvt(evt: AppEvent): void;
  /** Reliable: a chat bubble (also persisted to Neon separately). */
  sendChat(chat: ChatWire): void;
  /** Unreliable (UDP), ~SEND_HZ: the local player's transform + profile. */
  sendPos(payload: PlayerState): void;
  /** Reliable + addressed: a WebRTC voice signaling message (SDP/ICE) to one peer (the mesh ported from GTA-PORT). */
  sendVoice(from: string, to: string, signal: VoiceSignal): void;
  /** Unreliable (UDP): a voice PCM frame — proximity gain is applied client-side on receive. */
  sendVoiceFrame(frame: VoiceFrame): void;
}

/** Callbacks a transport invokes when realtime messages arrive (the {@link Presence} owns the state they touch). */
export interface TransportHandlers {
  onChat: (chat: ChatWire) => void;
  onEvt: (evt: AppEvent) => void;
  onLeave: (id: string) => void;
  onPos: (state: PlayerState) => void;
  /** A WebRTC voice signaling message addressed to us from `from`. */
  onVoice: (from: string, signal: VoiceSignal) => void;
  onVoiceFrame: (frame: VoiceFrame) => void;
}

/**
 * Build the realtime transport. alonHouse is geckos-only, so this ALWAYS returns a {@link GeckosTransport}
 * pointed at `NEXT_PUBLIC_GECKOS_URL` (the fly.io relay). If the env var is unset, the transport simply fails to
 * connect and logs a clear error (no multiplayer) rather than crashing the app.
 */
export function createTransport(): RealtimeTransport {
  const url = process.env.NEXT_PUBLIC_GECKOS_URL;
  if (!url) {
    console.error('[net] NEXT_PUBLIC_GECKOS_URL is not set — multiplayer is disabled.');
  }

  return new GeckosTransport(url ?? '');
}
