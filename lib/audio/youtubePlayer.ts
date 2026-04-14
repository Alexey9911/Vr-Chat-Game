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
}

const activePlayers = new Map<string, YTPlayerEntry>()

// Single global volume-sync interval for ALL YouTube players (replaces per-player intervals)
let globalVolumeSyncInterval: ReturnType<typeof setInterval> | null = null

function ensureVolumeSyncRunning(): void {
  if (globalVolumeSyncInterval) return
  globalVolumeSyncInterval = setInterval(() => {
    activePlayers.forEach((entry) => {
      try {
        entry.player.setVolume(Math.round(entry.ghostAudio.volume * 100))
      } catch {}
    })
  }, 200) // 5 Hz is enough for smooth volume transitions
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
    document.body.appendChild(containerEl)
  }
  return containerEl
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
  const ghost = new Audio()
  ghost.volume = AUDIO_VOLUME
  ghost.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
  ghost.loop = true

  const instances = getActiveAudioInstances()
  instances.set(`__youtube_${playerId}__`, ghost)

  ghost.play().catch(() => {})

  return ghost
}

function unregisterGhostAudio(playerId: string, ghost: HTMLAudioElement): void {
  ghost.pause()
  ghost.src = ''
  ghost.load()
  const instances = getActiveAudioInstances()
  instances.delete(`__youtube_${playerId}__`)
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
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
      },
      events: {
        onReady: (event: { target: YTPlayer }) => {
          clearTimeout(timeout)
          const target = event.target

          // unMute before playing
          target.unMute()

          // Register ghost audio for spatial audio
          const ghost = registerGhostAudio(playerId)

          // Set volume
          target.setVolume(Math.round(ghost.volume * 100))

          // Seek to startTime if syncing
          if (startTime && startTime > 0) {
            target.seekTo(startTime, true)
          }

          // Play
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
            // Ensure not muted
            if (event.target.isMuted?.()) {
              event.target.unMute()
            }
            // Update title
            try {
              const data = event.target.getVideoData()
              const entry = activePlayers.get(playerId)
              if (entry && data?.title) entry.videoTitle = data.title
            } catch {}
          } else if (event.data === window.YT.PlayerState.ENDED) {
            stopYouTubeForPlayer(playerId)
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

export function setYouTubeVolume(multiplier: number): void {
  // Update all ghost audios (spatial audio will then sync to YT players)
  activePlayers.forEach((entry) => {
    entry.ghostAudio.volume = Math.max(0, Math.min(1, AUDIO_VOLUME * multiplier))
  })
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
