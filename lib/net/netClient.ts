// netClient — the single glue between the geckos {@link Presence} layer and alonHouse's existing React/zustand
// world. It is the "Phase 3 cut": one fixed lobby on geckos.io/fly.io, NO Playroom, NO 10-per-lobby split.
//
// It is FLAG-GATED by `NEXT_PUBLIC_NET`: when it is NOT 'geckos', every export is inert and the app keeps using
// Playroom unchanged. When it IS 'geckos', the call sites (LobbyScreen connect, useCameraControls outbound,
// ChatInput, the music/mic/skin producers) route through here instead.
//
// Design (mirrors GTA-PORT canvas-host):
//   OUTBOUND — Presence PULLS the local player each tick via a StateGetter that reads the local player's own
//   zustand entry (`remotePlayers.get(localPlayerId)`), which the existing local-echo already keeps fresh. So we
//   don't thread writes through every file; the producers just merge fields into that same local entry.
//   INBOUND  — a single reconciler loop reads `presence.remote` and pushes each peer into the SAME
//   `updateRemotePlayer` the renderer already consumes (the RemotePlayer schema is unchanged), plus prune and a
//   global audio reconcile so a LATE JOINER hears the music a previous player already started (the persistent
//   youtubeVideoId/mediaStartEpoch ride the deduped `pos` and are re-announced to newcomers — exactly GTA-PORT's
//   model, unlike the old fire-and-forget RPC that newcomers never received).

import { EYE_HEIGHT } from '../camera/cameraConstants';
import { useMultiplayerStore, type RemotePlayer } from '../multiplayerStore';
import { Presence } from './presence';
import type { ChatWire, StateGetter, VoiceSignal } from './types';

/** The single fixed lobby id — only used as the Neon chat partition key (geckos itself has one global channel). */
export const GECKOS_LOBBY = 'alonverse';

// Spawn fallback for the StateGetter before the local avatar has moved (mirrors lib/multiplayerStore.ts).
const SPAWN_X = -59.95;
const SPAWN_Z = -87.86;
const SPAWN_ROT = (74.61 + 180) * (Math.PI / 180);

/** geckos.io/fly.io + Neon is the ONLY transport — pure sockets, Playroom fully removed. (Kept as a function so
 *  call sites don't churn; the Playroom branches are dead and being stripped.) */
export function isGeckos(): boolean {
  return true;
}

interface ChatLike {
  id: string;
  playerId: string;
  playerName: string;
  playerColor?: string;
  text: string;
  timestamp: number;
}

// Audio modules (client-only) — imported lazily on connect so SSR / the Playroom path never pull them.
interface YtModule {
  isYouTubePlayingForPlayer: (id: string) => boolean;
  playYouTubeForPlayer: (id: string, videoId: string, startTime?: number) => Promise<unknown>;
  setLocalYouTubePlayerId: (id: string) => void;
  stopYouTubeForPlayer: (id: string) => void;
}
interface MusicModule {
  isPlayingForPlayer: (id: string) => boolean;
  playMusicForPlayer: (id: string, skinId: string, startTime?: number) => void;
  stopMusicForPlayer: (id: string) => void;
}

let presence: Presence | null = null;
let reconcileTimer: number | null = null;
let ytMod: YtModule | null = null;
let musicMod: MusicModule | null = null;

/** Extra local fields that aren't part of the RemotePlayer schema but must ride the wire. */
const localExtra: { mediaStartEpoch?: number } = {};

/** Per-remote "what audio is currently running" keys, so we only (re)start a track when it actually changes. */
const audioKey = new Map<string, string>();
/** Ids we currently know about (for peer join/leave detection → voice). */
const knownIds = new Set<string>();
const bubbleTimers = new Map<string, ReturnType<typeof setTimeout>>();

let onPeerJoinCb: ((id: string) => void) | null = null;
let onPeerLeaveCb: ((id: string) => void) | null = null;

/** The live Presence instance (for voice wiring in LobbyScreen), or null when not connected / not geckos. */
export function getPresence(): Presence | null {
  return presence;
}

/** Register the voice peer-join/leave hooks (LobbyScreen wires these to vc.createOffer / vc.removePeer). */
export function onPeerJoin(cb: (id: string) => void): void {
  onPeerJoinCb = cb;
}
export function onPeerLeave(cb: (id: string) => void): void {
  onPeerLeaveCb = cb;
}

/** Merge fields into the LOCAL player's zustand entry — this is the source the StateGetter broadcasts. */
export function setLocalState(partial: Partial<RemotePlayer>): void {
  const { localPlayerId, updateRemotePlayer } = useMultiplayerStore.getState();
  if (localPlayerId) {
    updateRemotePlayer(localPlayerId, partial);
  }
}

/** Set (or clear) the epoch ms the current track started, so late joiners seek to the live position. */
export function setMediaStartEpoch(ms: number | undefined): void {
  localExtra.mediaStartEpoch = ms;
}

/** Broadcast a chat bubble to everyone (history persistence to Neon is done separately by the caller). */
export function sendChat(msg: ChatLike): void {
  presence?.sendChat({
    id: msg.id,
    playerId: msg.playerId,
    playerName: msg.playerName,
    playerColor: msg.playerColor,
    text: msg.text,
    timestamp: msg.timestamp,
  });
}

/** Broadcast an admin kick to everyone (only the target actually leaves; others drop them locally). */
export function kick(playerId: string): void {
  presence?.sendEvt({ t: 'kick', id: playerId });
}

/**
 * Join the single geckos lobby. Builds Presence with a StateGetter over the local zustand entry, starts the
 * inbound reconciler, and bridges chat + kick. Returns the minted local id (use it as localPlayerId).
 */
export async function connect(
  nick: string,
  profile: Partial<RemotePlayer>,
  onVoiceSignal?: (from: string, signal: VoiceSignal) => void,
): Promise<string> {
  // Lazy-load the client-only audio engines used by the reconciler.
  [ytMod, musicMod] = await Promise.all([
    import('../audio/youtubePlayer') as unknown as Promise<YtModule>,
    import('../audio/musicSystem') as unknown as Promise<MusicModule>,
  ]);

  const getState: StateGetter = () => {
    const st = useMultiplayerStore.getState();
    const e = st.localPlayerId ? st.remotePlayers.get(st.localPlayerId) : undefined;
    const pos = e?.position;
    return {
      x: pos?.x ?? SPAWN_X,
      y: pos?.y ?? EYE_HEIGHT,
      z: pos?.z ?? SPAWN_Z,
      rotationY: e?.rotationY ?? SPAWN_ROT,
      animation: e?.animation ?? null,
      name: e?.name ?? profile.name ?? nick,
      color: e?.color ?? profile.color ?? '#4a9eff',
      skinId: e?.skinId ?? profile.skinId,
      isAdmin: e?.isAdmin ?? profile.isAdmin,
      colors: e?.colors ?? profile.colors,
      isMusicPlaying: e?.isMusicPlaying ?? false,
      isYouTubePlaying: e?.isYouTubePlaying ?? false,
      youtubeVideoId: e?.youtubeVideoId,
      mediaStartEpoch: localExtra.mediaStartEpoch,
      isMicActive: e?.isMicActive ?? false,
    };
  };

  presence = new Presence(getState);

  // Incoming chat bubbles from OTHERS (Presence filters self-echo). Mirror the Playroom bubble behaviour.
  presence.onChat((wire) => {
    const { addChatMessage, updateRemotePlayer } = useMultiplayerStore.getState();
    addChatMessage({
      id: wire.id,
      playerId: wire.playerId,
      playerName: wire.playerName,
      playerColor: wire.playerColor,
      text: wire.text,
      timestamp: wire.timestamp,
    });
    updateRemotePlayer(wire.playerId, { chatMessage: wire.text });
    const prev = bubbleTimers.get(wire.playerId);
    if (prev) clearTimeout(prev);
    bubbleTimers.set(
      wire.playerId,
      setTimeout(() => {
        bubbleTimers.delete(wire.playerId);
        // Only clear the bubble if the player is still here — never resurrect a departed peer's entry.
        const st = useMultiplayerStore.getState();
        if (st.remotePlayers.has(wire.playerId)) {
          st.updateRemotePlayer(wire.playerId, { chatMessage: null });
        }
      }, 8000),
    );
  });

  // Generic app events — admin kick + AI-moderator live chat removal.
  presence.onEvt((evt) => {
    // The relay's AI moderator deleted these message ids from Neon → drop them from the
    // live chat log. The id is `${ts}-${playerId}`; clear the author's 3D bubble too so a
    // flagged line doesn't linger over their head.
    if (evt.t === 'chatRemoved') {
      const ids = Array.isArray(evt.ids) ? evt.ids : [];
      if (!ids.length) return;
      const { removeChatMessages, remotePlayers, updateRemotePlayer } = useMultiplayerStore.getState();
      removeChatMessages(ids);
      for (const id of ids) {
        const pid = id.slice(id.indexOf('-') + 1);
        if (pid && remotePlayers.has(pid)) updateRemotePlayer(pid, { chatMessage: null });
      }
      return;
    }
    if (evt.t !== 'kick') return;
    const { localPlayerId, removeRemotePlayer } = useMultiplayerStore.getState();
    if (evt.id === localPlayerId) {
      // I'm being kicked — leave + reload back to the lobby UI.
      try {
        disconnect();
      } catch {
        /* noop */
      }
      setTimeout(() => {
        try {
          window.location.href = window.location.pathname;
        } catch {
          window.location.reload();
        }
      }, 100);
    } else {
      removeRemotePlayer(evt.id); // kick-guard prevents re-add until they actually leave
      // The kicked peer may keep broadcasting until they reload — stop their audio + drop bookkeeping NOW
      // (the reconciler's kicked-guard then keeps it from restarting).
      stopRemoteAudio(evt.id);
      knownIds.delete(evt.id);
      const bt = bubbleTimers.get(evt.id);
      if (bt) {
        clearTimeout(bt);
        bubbleTimers.delete(evt.id);
      }
    }
  });

  // Register inbound voice signaling BEFORE join so a fast peer's answer/ICE isn't dropped (the reconciler can
  // fire createOffer on the first 60ms tick; the reply could land before a post-join registration ran).
  if (onVoiceSignal) {
    presence.onVoice(onVoiceSignal);
  }

  presence.join(nick);
  const id = presence.myId;

  // Seed the local entry with the profile so the StateGetter immediately broadcasts the right name/skin/colour.
  const store = useMultiplayerStore.getState();
  store.setLocalPlayerId(id);
  store.updateRemotePlayer(id, { id, ...profile });
  // Register the real id with the YT engine so the LOCAL player's own track keys to it (else getLocalPlayerId()
  // returns '__local__', the spatial loop can't find it, and the local YT plays at full volume ignoring the slider).
  ytMod?.setLocalYouTubePlayerId(id);

  startReconciler();
  return id;
}

/** Stop the reconciler, disconnect Presence, and clear all per-peer audio/bubbles. */
export function disconnect(): void {
  if (reconcileTimer !== null) {
    window.clearInterval(reconcileTimer);
    reconcileTimer = null;
  }
  // Tear down each remote's audio AND voice peer connection (the reconciler is stopped, so it won't do this).
  knownIds.forEach((id) => {
    stopRemoteAudio(id);
    onPeerLeaveCb?.(id);
  });
  knownIds.clear();
  // Stop the LOCAL player's own audio too (knownIds only ever holds remotes).
  const localId = useMultiplayerStore.getState().localPlayerId;
  if (localId) {
    stopRemoteAudio(localId);
  }
  audioKey.clear();
  bubbleTimers.forEach((t) => clearTimeout(t));
  bubbleTimers.clear();
  localExtra.mediaStartEpoch = undefined;
  presence?.leave();
  presence = null;
}

function startReconciler(): void {
  if (reconcileTimer !== null) return;
  // ~16 Hz — matches the 15 Hz send rate; the avatar component lerps between updates (same cadence the old
  // 100 ms Playroom poll fed, only smoother).
  reconcileTimer = window.setInterval(reconcile, 60);
}

function reconcile(): void {
  const p = presence;
  if (!p) return;
  p.prune();
  const store = useMultiplayerStore.getState();
  const current = new Set<string>();

  p.remote.forEach((peer, id) => {
    current.add(id);
    if (!knownIds.has(id)) {
      knownIds.add(id);
      onPeerJoinCb?.(id); // voice: create an offer to the new peer
    }
    store.updateRemotePlayer(id, {
      name: peer.name,
      color: peer.color,
      skinId: peer.skinId,
      isAdmin: peer.isAdmin,
      colors: peer.colors,
      position: { x: peer.x, y: peer.y, z: peer.z },
      rotationY: peer.rotationY,
      animation: peer.animation ?? null,
      isMusicPlaying: peer.isMusicPlaying ?? false,
      isYouTubePlaying: peer.isYouTubePlaying ?? false,
      youtubeVideoId: peer.youtubeVideoId,
      isMicActive: peer.isMicActive ?? false,
    });
    // Don't (re)start audio for a kicked peer who is still broadcasting (their avatar is already hidden by the
    // kicked-guard in updateRemotePlayer; restarting their track here would undo the kick teardown each tick).
    if (!store.kickedPlayerIds.has(id)) {
      reconcileRemoteAudio(id, peer.isYouTubePlaying, peer.youtubeVideoId, peer.isMusicPlaying, peer.skinId, peer.mediaStartEpoch);
    }
  });

  // Departed peers (pruned / left) → drop avatar + audio + voice peer + any pending bubble timer. NOT a kick,
  // so they can rejoin. Clearing the bubble timer is essential: otherwise it fires after dropRemotePlayer and
  // re-creates a phantom entry (name='') that lingers in the player list forever.
  knownIds.forEach((id) => {
    if (!current.has(id)) {
      knownIds.delete(id);
      stopRemoteAudio(id);
      const bt = bubbleTimers.get(id);
      if (bt) {
        clearTimeout(bt);
        bubbleTimers.delete(id);
      }
      store.dropRemotePlayer(id);
      onPeerLeaveCb?.(id);
    }
  });
}

/**
 * Start/stop a remote player's audio to match their broadcast state. YT and skin music are mutually exclusive.
 * elapsed = now - mediaStartEpoch makes a LATE JOINER seek to the live position (the music late-join fix).
 */
function reconcileRemoteAudio(
  id: string,
  isYt: boolean | undefined,
  videoId: string | undefined,
  isMusic: boolean | undefined,
  skinId: string | undefined,
  startEpoch: number | undefined,
): void {
  const elapsed = startEpoch ? Math.max(0, (Date.now() - startEpoch) / 1000) : 0;
  if (isYt && videoId) {
    const key = `yt:${videoId}:${startEpoch ?? ''}`;
    if (audioKey.get(id) !== key) {
      audioKey.set(id, key);
      musicMod?.stopMusicForPlayer(id); // ensure the other kind is off
      Promise.resolve(ytMod?.playYouTubeForPlayer(id, videoId, elapsed)).catch(() => {
        audioKey.delete(id); // retry next tick on failure (autoplay block, iframe race, …)
      });
    }
  } else if (isMusic && skinId) {
    const key = `skin:${skinId}:${startEpoch ?? ''}`;
    if (audioKey.get(id) !== key) {
      audioKey.set(id, key);
      try {
        ytMod?.stopYouTubeForPlayer(id);
        musicMod?.playMusicForPlayer(id, skinId, elapsed);
      } catch {
        audioKey.delete(id);
      }
    }
  } else if (audioKey.has(id)) {
    audioKey.delete(id);
    stopRemoteAudio(id);
  }
}

function stopRemoteAudio(id: string): void {
  try {
    if (ytMod?.isYouTubePlayingForPlayer(id)) ytMod.stopYouTubeForPlayer(id);
  } catch {
    /* noop */
  }
  try {
    if (musicMod?.isPlayingForPlayer(id)) musicMod.stopMusicForPlayer(id);
  } catch {
    /* noop */
  }
  audioKey.delete(id);
}

/** Translate the voiceChatSystem RPC-style sender into addressed geckos `voice` signaling. */
export function sendVoiceSignal(event: string, data: { candidate?: string; sdp?: string; to?: string }): void {
  if (!presence || !data.to) return;
  const kind: VoiceSignal['kind'] = event === 'voiceOffer' ? 'offer' : event === 'voiceAnswer' ? 'answer' : 'ice';
  presence.sendVoice(data.to, { kind, sdp: data.sdp, candidate: data.candidate });
}
