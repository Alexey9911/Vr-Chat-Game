/**
 * YouTube Player System
 * 
 * Plays audio from YouTube URLs using the official YouTube IFrame Player API.
 * Works like VRChat: paste a YouTube link → hear the audio.
 * 
 * Multi-player support:
 *   - Each player has their own YT player + ghost audio (per-player Map).
 *   - RPC sync: playYouTube/stopYouTube broadcast to all players.
 *   - New players joining get synced via youtubeData state.
 * 
 * Integration with existing musicSystem:
 *   - Registers "ghost" HTMLAudioElements in musicSystem's activeAudioInstances
 *     so the spatial audio system (which sets audio.volume) controls YouTube volume.
 *   - A polling loop syncs each ghost element's volume → its YT player.setVolume().
 *   - Music Volume slider controls both skin music AND YouTube music.
 */

import { getActiveAudioInstances, AUDIO_VOLUME } from './musicSystem'

// ─── Types ────────────────────────────────────────────────────────────

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  setVolume: (vol: number) => void
  getVolume: () => number
  getPlayerState: () => number
  getDuration: () => number
  getCurrentTime: () => number
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  destroy: () => void
  getVideoData: () => { title: string; video_id: string }
  mute: () => void
  unMute: () => void
  isMuted: () => boolean
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        config: {
          videoId: string
          width?: number
          height?: number
          playerVars?: Record<string, any>
          events?: {
            onReady?: (event: { target: YTPlayer }) => void
            onStateChange?: (event: { data: number; target: YTPlayer }) => void
            onError?: (event: { data: number }) => void
          }
        }
      ) => YTPlayer
      PlayerState: {
        PLAYING: number
        PAUSED: number
        ENDED: number
        BUFFERING: number
        CUED: number
      }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

// ─── Per-Player State ─────────────────────────────────────────────────

interface YTPlayerEntry {
  player: YTPlayer
  ghostAudio: HTMLAudioElement
  videoId: string
  videoTitle: string
  divId: string
  // FIX (Firefox) — Track last values we pushed through postMessage so we
  // only send `setVolume` / `mute` / `unMute` when something actually
  // changed. Firefox's YT iframe is known to silently drop rapid repeated
  // `setVolume` calls, so reducing the noise dramatically improves the
  // chance that the change is applied.
  lastSentVol: number
  lastSentMuted: boolean | null
  // FIX (Firefox) — Firefox's YT iframe API sometimes ignores BOTH
  // `setVolume` AND `mute()` (the postMessage arrives but the media element
  // inside the cross-origin iframe keeps its previous state). As an
  // ultimate fallback we `pauseVideo()` when the player should be silent
  // and `playVideo()` + `seekTo(currentElapsed)` when it should resume,
  // which is the one API the iframe always honors.
  startEpochMs: number
  isPausedFar: boolean
}

const activePlayers = new Map<string, YTPlayerEntry>()

// Hard cutoff: below this ghost volume we force `mute()` on the iframe
// instead of relying on `setVolume(0)` (which Firefox often ignores).
const MUTE_THRESHOLD = 0.02

// Single global volume-sync interval for ALL YouTube players (replaces per-player intervals)
let globalVolumeSyncInterval: ReturnType<typeof setInterval> | null = null

function ensureVolumeSyncRunning(): void {
  if (globalVolumeSyncInterval) return
  globalVolumeSyncInterval = setInterval(() => {
    activePlayers.forEach((entry, playerId) => {
      const ghostVol = entry.ghostAudio.volume
      const shouldSilence = ghostVol < MUTE_THRESHOLD
      const targetVol = Math.round(ghostVol * 100)

      try {
        if (shouldSilence) {
          // HARD CUTOFF — pauseVideo() is the ONE postMessage the YT iframe
          // always honors across every browser (mute + setVolume get dropped
          // silently in Firefox). When the player drifts into range we
          // seek to the correct synced offset and resume.
          if (!entry.isPausedFar) {
            entry.player.pauseVideo()
            // Also attempt mute+setVolume(0) in case the browser DOES honor
            // them — belt-and-suspenders.
            try { entry.player.mute() } catch {}
            try { entry.player.setVolume(0) } catch {}
            entry.isPausedFar = true
            entry.lastSentMuted = true
            entry.lastSentVol = 0
            console.log('[YT spatial] FAR → pause', playerId, 'ghostVol:', ghostVol.toFixed(3))
          }
        } else {
          if (entry.isPausedFar) {
            // Resume: seek to the elapsed-since-host-started position so
            // we stay in sync with other clients, then play + unmute.
            const elapsedSec = Math.max(0, (Date.now() - entry.startEpochMs) / 1000)
            try { entry.player.seekTo(elapsedSec, true) } catch {}
            try { entry.player.unMute() } catch {}
            try { entry.player.playVideo() } catch {}
            entry.isPausedFar = false
            entry.lastSentMuted = false
            entry.lastSentVol = -1 // force setVolume below
            console.log('[YT spatial] NEAR → resume', playerId, 'seek:', elapsedSec.toFixed(1) + 's', 'vol:', targetVol)
          }
          // Also ensure unmuted when audible (some browsers leave mute stuck).
          if (entry.lastSentMuted !== false) {
            try { entry.player.unMute() } catch {}
            entry.lastSentMuted = false
            entry.lastSentVol = -1
          }
          // Only send setVolume when the integer value actually changed.
          if (targetVol !== entry.lastSentVol) {
            entry.player.setVolume(targetVol)
            entry.lastSentVol = targetVol
          }
        }
      } catch {}
    })
  }, 100) // 10 Hz — snappier response for Firefox; dedup above keeps postMessages down
}

function stopVolumeSyncIfEmpty(): void {
  if (activePlayers.size === 0 && globalVolumeSyncInterval) {
    clearInterval(globalVolumeSyncInterval)
    globalVolumeSyncInterval = null
  }
}

// ─── Global State ─────────────────────────────────────────────────────

let apiReady = false
let apiLoading = false
let containerEl: HTMLDivElement | null = null

// ─── URL Parsing ──────────────────────────────────────────────────────

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim()
  
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed

  const watchMatch = trimmed.match(/[?&]v=([\w-]{11})/)
  if (watchMatch) return watchMatch[1]

  const shortMatch = trimmed.match(/youtu\.be\/([\w-]{11})/)
  if (shortMatch) return shortMatch[1]

  const pathMatch = trimmed.match(/youtube\.com\/(?:shorts|live)\/([\w-]{11})/)
  if (pathMatch) return pathMatch[1]

  const embedMatch = trimmed.match(/youtube\.com\/embed\/([\w-]{11})/)
  if (embedMatch) return embedMatch[1]

  return null
}

// ─── API Loading ──────────────────────────────────────────────────────

function loadYouTubeAPI(): Promise<void> {
  if (apiReady) return Promise.resolve()
  if (apiLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (apiReady) { clearInterval(check); resolve() }
      }, 100)
      setTimeout(() => { clearInterval(check); resolve() }, 10000)
    })
  }

  apiLoading = true

  return new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => {
      apiReady = true
      apiLoading = false
      resolve()
    }

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)

    setTimeout(() => {
      if (!apiReady) {
        apiReady = !!(window.YT && window.YT.Player)
        apiLoading = false
        resolve()
      }
    }, 8000)
  })
}

// ─── Container ────────────────────────────────────────────────────────

function ensureContainer(): HTMLDivElement {
  if (!containerEl) {
    containerEl = document.createElement('div')
    containerEl.id = 'yt-player-container'
    // Behind the game canvas, visible to browser rendering pipeline but not to user
    containerEl.style.cssText = 'position:fixed;left:0;top:0;width:480px;height:270px;z-index:-1;opacity:0.01;pointer-events:none;overflow:hidden;'
    // FIX — prevent keyboard focus from ever landing on the iframe.
    // Without this, after Alt+Tab back (or any browser focus restore) the
    // cross-origin YouTube iframe could silently capture ALL keydown events:
    // WASD/Shift/Space would go to YouTube and never reach the game window,
    // leaving the player unable to move while the mouse still orbited the
    // camera. tabindex="-1" + aria-hidden keep the iframe out of focus order.
    containerEl.tabIndex = -1
    containerEl.setAttribute('aria-hidden', 'true')
    document.body.appendChild(containerEl)
    installIframeFocusGuard()
  }
  return containerEl
}

// Defensive guard — if, despite tabindex=-1, any iframe inside our YT
// container ever becomes the active element (some browsers restore focus
// to the last-focused iframe after window.focus), immediately blur it and
// return focus to <body> so the game's window-level key listeners catch
// the player's WASD again.
let iframeFocusGuardInstalled = false
function installIframeFocusGuard(): void {
  if (iframeFocusGuardInstalled || typeof document === 'undefined') return
  iframeFocusGuardInstalled = true
  const onFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target.tagName !== 'IFRAME') return
    // Only handle iframes inside our YT container.
    if (!containerEl || !containerEl.contains(target)) return
    try { (target as HTMLIFrameElement).blur() } catch {}
    try { (document.body as any).focus?.() } catch {}
  }
  document.addEventListener('focusin', onFocusIn, true)
  // Also mark every iframe YouTube adds as non-tabbable.
  try {
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if ((n as HTMLElement).tagName === 'IFRAME') {
            try { (n as HTMLIFrameElement).tabIndex = -1 } catch {}
          }
        })
      }
    })
    if (containerEl) mo.observe(containerEl, { childList: true, subtree: true })
  } catch {}
}

function createPlayerDiv(): string {
  const container = ensureContainer()
  const playerDiv = document.createElement('div')
  const divId = `yt-player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  playerDiv.id = divId
  container.appendChild(playerDiv)
  return divId
}

// ─── Ghost Audio ──────────────────────────────────────────────────────

function registerGhostAudio(playerId: string): HTMLAudioElement {
  // FIX (Firefox) — The ghost audio is ONLY a volume proxy used by
  // spatialAudioSystem: the spatial loop reads and writes `audio.volume`
  // each tick, and our YT sync loop mirrors that value to the real iframe
  // via `setVolume` / `pauseVideo`. We never actually output audio through
  // this element.
  //
  // Previously we assigned a silent base64 WAV + `ghost.play()` to keep
  // the element "active". Firefox FAILS to decode that tiny WAV
  // (NS_ERROR_DOM_MEDIA_METADATA_ERR in the console) → `audio.error` gets
  // set → `updateSpatialAudio` skips the element (its guard is
  // `if (!audio || audio.error) return`) → `ghost.volume` never updates
  // on Firefox → no `FAR → pause` ever fires and YT plays at a constant
  // volume everywhere on the map. Chrome just happens to decode the WAV
  // without issue, which is why it worked there.
  //
  // Omitting the src entirely leaves `audio.error` as null, spatial
  // processes the ghost normally, and nothing tries to play media.
  const ghost = new Audio()
  ghost.volume = AUDIO_VOLUME

  const instances = getActiveAudioInstances()
  instances.set(`__youtube_${playerId}__`, ghost)

  return ghost
}

function unregisterGhostAudio(playerId: string, ghost: HTMLAudioElement): void {
  // No src was ever set, so nothing to pause/reset — just drop the entry.
  const instances = getActiveAudioInstances()
  instances.delete(`__youtube_${playerId}__`)
  void ghost
}

// ─── Stream Info ──────────────────────────────────────────────────────

export interface YouTubeStreamInfo {
  title: string
  videoId: string
  duration: number
}

// ─── Playback (per-player) ────────────────────────────────────────────

/**
 * Play YouTube audio for a specific player.
 * Used both locally and via RPC for remote players.
 */
export async function playYouTubeForPlayer(playerId: string, videoId: string, startTime?: number): Promise<YouTubeStreamInfo> {
  // Stop existing for this player
  stopYouTubeForPlayer(playerId)

  await loadYouTubeAPI()

  if (!window.YT || !window.YT.Player) {
    throw new Error('YouTube Player API failed to load. Check your internet connection.')
  }

  const divId = createPlayerDiv()

  return new Promise<YouTubeStreamInfo>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('YouTube player timed out. Try again.'))
    }, 15000)

    const ytPlayer = new window.YT.Player(divId, {
      width: 480,
      height: 270,
      videoId,
      playerVars: {
        // FIX — Firefox blocks `playVideo()` on iframes created after page
        // load without a user gesture, so late joiners never heard anything.
        // `autoplay: 1` + `mute: 1` is the only combination always allowed
        // by every browser's autoplay policy. We then `unMute()` inside the
        // PLAYING state change, which is permitted because the page already
        // had a user gesture (the lobby "Play" button).
        autoplay: 1,
        mute: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        playsinline: 1,
      },
      events: {
        onReady: (event: { target: YTPlayer }) => {
          clearTimeout(timeout)
          const target = event.target

          // Register ghost audio for spatial audio
          const ghost = registerGhostAudio(playerId)

          // Set initial volume BEFORE unmuting so there's no loud-burst
          // between unMute() and the first spatial tick.
          target.setVolume(Math.round(ghost.volume * 100))

          // Seek to startTime if syncing
          if (startTime && startTime > 0) {
            target.seekTo(startTime, true)
          }

          // Play (mostly redundant with autoplay:1 but harmless)
          target.playVideo()

          // Get title
          let title = ''
          try {
            const data = target.getVideoData()
            title = data?.title || ''
          } catch {}

          // Store entry
          activePlayers.set(playerId, {
            player: target,
            ghostAudio: ghost,
            videoId,
            videoTitle: title,
            divId,
            lastSentVol: -1,
            lastSentMuted: null,
            // startEpochMs = wall-clock time when the video would have been
            // at second 0. If the caller passed `startTime` (elapsed seconds
            // since the host started playing), we back-date accordingly so
            // resume-after-far-pause can seek to the correct synced offset.
            startEpochMs: Date.now() - (startTime && startTime > 0 ? startTime * 1000 : 0),
            isPausedFar: false,
          })

          // Start global volume sync if not running
          ensureVolumeSyncRunning()

          console.log('[YouTube] Player ready for', playerId, 'isMuted:', target.isMuted?.(), 'volume:', target.getVolume?.())

          resolve({
            title,
            videoId,
            duration: target.getDuration?.() || 0,
          })
        },
        onStateChange: (event: { data: number; target: YTPlayer }) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            // FIX (Firefox) — unMute + re-apply spatial volume once the
            // iframe is truly playing. Firefox sometimes drops postMessage
            // setVolume calls made during `onReady`/buffering, which caused
            // "plays at full volume, no spatial" for remote YT ghosts.
            // Re-applying here guarantees the first audible frame already
            // carries the distance-attenuated volume.
            try {
              if (event.target.isMuted?.()) event.target.unMute()
            } catch {}
            try {
              const entry = activePlayers.get(playerId)
              if (entry) {
                event.target.setVolume(Math.round(entry.ghostAudio.volume * 100))
              }
            } catch {}
            // Update title
            try {
              const data = event.target.getVideoData()
              const entry = activePlayers.get(playerId)
              if (entry && data?.title) entry.videoTitle = data.title
            } catch {}
          } else if (event.data === window.YT.PlayerState.ENDED) {
            // FIX — On ENDED, if this is the LOCAL player's own video, also
            // reset Playroom state + notify UI. Previously we only called
            // `stopYouTubeForPlayer` locally, which removed our own iframe
            // but left `isYouTubePlaying=true` / `youtubeData=…` in the
            // Playroom state, so remote peers kept showing the embed cover
            // image on this avatar forever.
            const isLocal = playerId === getLocalPlayerId()
            stopYouTubeForPlayer(playerId)
            if (isLocal) {
              // Clear module-level local tracking so `getCurrentVideoTitle`
              // / `isYouTubeAudioPlaying` immediately reflect the end.
              localVideoTitle = ''
              localVideoId = ''
              // Reset PlayroomKit state so remotes stop polling the embed.
              import('playroomkit').then((pk) => {
                const me = pk.myPlayer?.()
                if (me?.id) {
                  me.setState('isYouTubePlaying', false)
                  me.setState('youtubeData', null)
                }
              }).catch(() => {})
              // Notify the UI (LobbyScreen / YouTubeModal) so the
              // "ytPlaying" React state clears without a manual stop click.
              try {
                window.dispatchEvent(new CustomEvent('yt-ended'))
              } catch {}
            }
          }
        },
        onError: (event: { data: number }) => {
          clearTimeout(timeout)
          stopYouTubeForPlayer(playerId)
          const codes: Record<number, string> = {
            2: 'Invalid video ID',
            5: 'HTML5 player error',
            100: 'Video not found',
            101: 'Video cannot be embedded (restricted by owner)',
            150: 'Video cannot be embedded (restricted by owner)',
          }
          const msg = codes[event.data] || `YouTube error code ${event.data}`
          reject(new Error(msg))
        },
      },
    })
  })
}

/**
 * Stop YouTube audio for a specific player
 */
export function stopYouTubeForPlayer(playerId: string): void {
  const entry = activePlayers.get(playerId)
  if (entry) {
    unregisterGhostAudio(playerId, entry.ghostAudio)
    try { entry.player.stopVideo(); entry.player.destroy() } catch {}
    // Remove the div
    const div = document.getElementById(entry.divId)
    if (div) div.remove()
    activePlayers.delete(playerId)
    stopVolumeSyncIfEmpty()
  }
}

/**
 * Stop all YouTube audio
 */
export function stopAllYouTube(): void {
  Array.from(activePlayers.keys()).forEach(stopYouTubeForPlayer)
}

// ─── Auto-cleanup on page unload ───────────────────────────────────────
// Without this, a YouTube iframe that was playing when the user reloads
// keeps a ghost audio context alive for a brief window (and on some
// browsers, until GC), which manifested as "music keeps playing at full
// volume even after I left the page". `pagehide` fires reliably on
// tab-close, reload and bfcache; `beforeunload` is a belt-and-suspenders
// for older browsers.
if (typeof window !== 'undefined') {
  const handleUnload = () => {
    try {
      activePlayers.forEach((entry) => {
        try { entry.player?.stopVideo?.() } catch {}
        try { entry.player?.destroy?.() } catch {}
      })
      activePlayers.clear()
      if (globalVolumeSyncInterval) {
        clearInterval(globalVolumeSyncInterval)
        globalVolumeSyncInterval = null
      }
    } catch {}
  }
  window.addEventListener('pagehide', handleUnload)
  window.addEventListener('beforeunload', handleUnload)
}

// ─── Local Player Convenience ─────────────────────────────────────────

// Track the local player's current video for UI display
let localVideoTitle = ''
let localVideoId = ''
let cachedLocalPlayerId: string | null = null

/**
 * Set the local player ID (called from LobbyScreen on connect)
 */
export function setLocalYouTubePlayerId(id: string): void {
  cachedLocalPlayerId = id
}

function getLocalPlayerId(): string {
  return cachedLocalPlayerId || '__local__'
}

/**
 * Play YouTube audio for the local player (convenience function for UI)
 * Also sets local tracking state for the UI
 */
export async function playYouTubeAudio(url: string): Promise<YouTubeStreamInfo> {
  const videoId = extractVideoId(url)
  if (!videoId) {
    throw new Error('Invalid YouTube URL. Paste a link like https://youtube.com/watch?v=...')
  }

  // Get local player ID if not cached yet
  if (!cachedLocalPlayerId) {
    try {
      const pk = await import('playroomkit')
      const me = pk.myPlayer?.()
      if (me?.id) cachedLocalPlayerId = me.id
    } catch {}
  }

  const info = await playYouTubeForPlayer(getLocalPlayerId(), videoId)
  localVideoTitle = info.title
  localVideoId = videoId
  return info
}

export function stopYouTubeAudio(): void {
  stopYouTubeForPlayer(getLocalPlayerId())
  localVideoTitle = ''
  localVideoId = ''
}

export function pauseYouTubeAudio(): void {
  const entry = activePlayers.get(getLocalPlayerId())
  if (entry) entry.player.pauseVideo()
}

export function resumeYouTubeAudio(): void {
  const entry = activePlayers.get(getLocalPlayerId())
  if (entry) entry.player.playVideo()
}

// ─── Volume ───────────────────────────────────────────────────────────

export function setYouTubeVolume(_multiplier: number): void {
  // FIX — NO-OP by design. The master music-volume slider already updates
  // `globalVolumeMultiplier` in musicSystem via `setGlobalVolumeMultiplier`,
  // and `updateSpatialAudio` multiplies its distance-based volume by
  // `getGlobalVolumeMultiplier()` on every 100ms tick — so the multiplier
  // DOES apply to YT playback, but through the spatial path which preserves
  // distance attenuation.
  //
  // Previously this function wrote `AUDIO_VOLUME * multiplier` FLAT to every
  // ghost audio, bypassing distance. Combined with the LobbyScreen effect
  // `useEffect(() => { setYouTubeVolume(settingsVolume / 100) }, [settingsVolume])`
  // firing on mount / every slider drag, it clobbered spatial and caused
  // remote YT music to play at a constant volume across the entire map.
  // Keep the export to avoid breaking the callers in LobbyScreen.tsx
  // (line 1011) and YouTubeModal.tsx (line 35).
}

// ─── Queries ──────────────────────────────────────────────────────────

export function isYouTubeAudioPlaying(): boolean {
  return activePlayers.has(getLocalPlayerId())
}

export function getCurrentVideoTitle(): string {
  const entry = activePlayers.get(getLocalPlayerId())
  return entry?.videoTitle || localVideoTitle
}

export function getCurrentVideoId(): string {
  const entry = activePlayers.get(getLocalPlayerId())
  return entry?.videoId || localVideoId
}

/**
 * Check if a specific player has YouTube audio playing
 */
export function isYouTubePlayingForPlayer(playerId: string): boolean {
  return activePlayers.has(playerId)
}
