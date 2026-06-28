import type { RealtimeTransport, TransportHandlers } from './realtime-transport';
import type { AppEvent, ChatWire, PlayerState, VoiceFrame, VoiceSignal } from './types';

/**
 * Plain WebSocket (TCP) realtime backend for alonHouse, pointed at the fly.io relay (`server/`).
 *
 * WHY WebSockets instead of geckos.io (WebRTC/UDP): geckos needs ICE/STUN to establish a UDP
 * DataChannel, but fly.io NATs the relay machine's UDP EGRESS through a SHARED IP that differs from
 * its dedicated INGRESS IPv4, so the relay could only ever advertise its internal `172.x` candidate
 * and browsers silently failed ICE — live presence/chat never worked (only Neon-persisted history).
 * WebSockets are TCP: they traverse any NAT, need no ICE/STUN/dedicated-IPv4, and fly's HTTP/TLS
 * service already works. Same wire protocol as before (hello/pos/chat/evt/vframe/voice/leave), now
 * as JSON `{ e: <event>, d: <data> }` frames. Auto-reconnects with backoff so a dropped socket
 * recovers without the user reloading.
 *
 * Reuses `NEXT_PUBLIC_GECKOS_URL` (https://…) — it's just converted to wss://… here, so no env change.
 */
interface Frame {
  d: unknown;
  e: string;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 8000;

export class WebSocketTransport implements RealtimeTransport {
  private closedByUs = false;
  private handlers: null | TransportHandlers = null;
  private id = '';
  private nick = '';
  private reconnectAttempts = 0;
  private reconnectTimer: null | number = null;
  private readonly url: string;
  private ws: null | WebSocket = null;

  constructor(raw: string) {
    // https://host → wss://host ; http://host → ws://host
    this.url = raw ? raw.replace(/^http/i, 'ws') : '';
  }

  connect(id: string, nick: string, handlers: TransportHandlers): void {
    this.id = id;
    this.nick = nick;
    this.handlers = handlers;
    this.closedByUs = false;
    this.open();
  }

  disconnect(): void {
    this.closedByUs = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws?.close();
    } catch {
      /* noop */
    }
    this.ws = null;
  }

  sendChat(chat: ChatWire): void {
    this.sendFrame('chat', chat);
  }

  sendEvt(evt: AppEvent): void {
    this.sendFrame('evt', evt);
  }

  sendPos(payload: PlayerState): void {
    this.sendFrame('pos', payload);
  }

  sendVoice(from: string, to: string, signal: VoiceSignal): void {
    this.sendFrame('voice', { from, signal, to });
  }

  sendVoiceFrame(frame: VoiceFrame): void {
    this.sendFrame('vframe', frame);
  }

  private open(): void {
    if (!this.url) {
      console.error('[ws] NEXT_PUBLIC_GECKOS_URL missing — multiplayer disabled.');

      return;
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();

      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.sendFrame('hello', { id: this.id, nick: this.nick });
    };

    ws.onmessage = (ev: MessageEvent) => {
      let f: Frame;
      try {
        f = JSON.parse(typeof ev.data === 'string' ? ev.data : '') as Frame;
      } catch {
        return;
      }
      const h = this.handlers;
      if (!h) {
        return;
      }
      switch (f.e) {
        case 'chat':
          h.onChat(f.d as ChatWire);
          break;
        case 'evt':
          h.onEvt(f.d as AppEvent);
          break;
        case 'leave':
          h.onLeave((f.d as { id: string }).id);
          break;
        case 'pos':
          h.onPos(f.d as PlayerState);
          break;
        case 'vframe':
          h.onVoiceFrame(f.d as VoiceFrame);
          break;
        case 'voice': {
          const d = f.d as { from: string; signal: VoiceSignal; to: string };
          h.onVoice(d.from, d.signal);
          break;
        }
      }
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* onclose will schedule the reconnect */
      }
    };

    ws.onclose = () => {
      if (!this.closedByUs) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.closedByUs || this.reconnectTimer !== null) {
      return;
    }
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private sendFrame(e: string, d: unknown): void {
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ d, e }));
      } catch {
        /* noop */
      }
    }
  }
}
