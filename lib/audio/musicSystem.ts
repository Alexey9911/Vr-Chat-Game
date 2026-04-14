/**
 * Music System for Skin-Specific Audio
 * 
 * Handles synchronized music playback across all players in lobby.
 * Each skin has its own unique audio file.
 */

export interface SkinAudioConfig {
  skinId: string
  audioPath: string
  displayName: string
}

// Audio file mapping for each skin
// NOTA: Usando snoopdogsong.mp3 como placeholder para todos hasta que tengas los archivos específicos
export const SKIN_AUDIO_MAP: Record<string, string> = {
  'elon': '/sounds/snoopdogsong.mp3',        // TODO: Reemplazar con /sounds/elon-meme.mp3
  'elonmuskchibi': '/sounds/elonmusksong.mp3', // 🎵 Elon Chibi skin song
  'ai16z': '/sounds/ai16z.mp3',                 // 🎵 AI16Z skin song
  'trumpskin': '/sounds/trumpsong.mp3',      // 🎵 Trump skin exclusive song
  'alon': '/alonsong.mp3',                    // 🎵 Alon skin song
  // 'soldier' (default) - no audio
}

// Volume configuration
export const AUDIO_VOLUME = 0.5 // 50% volume (base)
export const AUDIO_MAX_DISTANCE = 20 // For spatial audio (Phase 4)

// Global volume multiplier (0-1), controlled by settings
let globalVolumeMultiplier = 1.0

export function setGlobalVolumeMultiplier(multiplier: number): void {
  globalVolumeMultiplier = Math.max(0, Math.min(1, multiplier))
  activeAudioInstances.forEach((audio) => {
    if (!audio.error) audio.volume = AUDIO_VOLUME * globalVolumeMultiplier
  })
}

export function getGlobalVolumeMultiplier(): number {
  return globalVolumeMultiplier
}

// Store active audio instances
const activeAudioInstances = new Map<string, HTMLAudioElement>()

// Track which players have music playing (for spatial audio and UI indicators)
const musicPlayingState = new Map<string, boolean>()

// Track which players are currently LOADING audio to prevent duplicates
const audioLoadingState = new Map<string, boolean>()

// AudioContext for browser permission handling
let audioContextInitialized = false

/**
 * Initialize AudioContext on first user interaction
 * This unlocks audio playback on browsers that require user gesture
 */
export function initializeAudioContext(): void {
  if (audioContextInitialized) return
  
  try {
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
    if (AudioContext) {
      const ctx = new AudioContext()
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          audioContextInitialized = true
        })
      } else {
        audioContextInitialized = true
      }
    }
  } catch (err) {
  }
}

/**
 * Check if a skin has audio available
 */
export function hasSkinAudio(skinId: string): boolean {
  return skinId in SKIN_AUDIO_MAP
}

/**
 * Get audio path for a skin
 */
export function getAudioPath(skinId: string): string | null {
  return SKIN_AUDIO_MAP[skinId] || null
}

/**
 * Play music for a specific player
 * This function plays audio locally when triggered by any player
 * @param startTime - Optional elapsed time in seconds to sync with ongoing music
 */
export function playMusicForPlayer(playerId: string, skinId: string, startTime?: number): void {
  // Prevent duplicate calls - if already loading, skip
  if (audioLoadingState.get(playerId)) return
  
  initializeAudioContext()

  const audioPath = getAudioPath(skinId)
  if (!audioPath) return
  
  // Mark as loading
  audioLoadingState.set(playerId, true)
  

  // Stop existing audio for this player if any
  const existingAudio = activeAudioInstances.get(playerId)
  if (existingAudio) {
    // Remove ALL event listeners before cleanup
    existingAudio.onerror = null
    existingAudio.onended = null
    existingAudio.onloadstart = null
    existingAudio.onloadeddata = null
    existingAudio.oncanplay = null
    
    existingAudio.pause()
    existingAudio.src = ''
    existingAudio.load()
    activeAudioInstances.delete(playerId)
  }

  try {
    const audio = new Audio(audioPath)
    audio.volume = AUDIO_VOLUME * globalVolumeMultiplier
    audio.preload = 'auto'

    const cleanup = () => {
      const audioToClean = activeAudioInstances.get(playerId)
      if (audioToClean) {
        audioToClean.pause()
        audioToClean.src = ''
        audioToClean.load()
      }
      activeAudioInstances.delete(playerId)
      musicPlayingState.set(playerId, false)
      audioLoadingState.delete(playerId) // Clear loading flag
      
      // Update player state in PlayroomKit if available
      if (typeof window !== 'undefined') {
        import('playroomkit').then(({ myPlayer }) => {
          const player = myPlayer()
          if (player && player.id === playerId) {
            player.setState('isMusicPlaying', false)
            player.setState('musicData', null)
          }
        }).catch(() => {})
      }
    }

    audio.onerror = (e) => {
      cleanup()
    }
    
    audio.onended = cleanup

    // Set current time if syncing with ongoing music
    if (startTime && startTime > 0) {
      // Wait for audio to load metadata before seeking
      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && startTime < audio.duration) {
          audio.currentTime = Math.min(startTime, audio.duration - 1)
        }
      })
    }

    // Store audio instance BEFORE playing to avoid race conditions
    activeAudioInstances.set(playerId, audio)
    musicPlayingState.set(playerId, true)
    
    audio.play()
      .then(() => {
        audioLoadingState.delete(playerId)
      })
      .catch((err) => {
        audioLoadingState.delete(playerId)
        cleanup()
      })
  } catch (error) {
    audioLoadingState.delete(playerId) // Clear loading flag on exception
  }
}

/**
 * Stop music for a specific player
 */
export function stopMusicForPlayer(playerId: string): void {
  const audio = activeAudioInstances.get(playerId)
  if (audio) {
    audio.pause()
    audio.currentTime = 0
    audio.src = '' // Free memory by clearing source
    audio.load() // Reset audio element
    activeAudioInstances.delete(playerId)
    musicPlayingState.set(playerId, false)
  }
}

/**
 * Stop all music instances
 */
export function stopAllMusic(): void {
  activeAudioInstances.forEach((audio, playerId) => {
    stopMusicForPlayer(playerId)
  })
  activeAudioInstances.clear()
  musicPlayingState.clear()
}

/**
 * Get number of active audio instances
 */
export function getActiveAudioCount(): number {
  return activeAudioInstances.size
}

/**
 * Check if a player is currently playing music
 */
export function isPlayingForPlayer(playerId: string): boolean {
  return musicPlayingState.get(playerId) === true
}

/**
 * Get active audio instances (for spatial audio system)
 */
export function getActiveAudioInstances(): Map<string, HTMLAudioElement> {
  return activeAudioInstances
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    stopAllMusic()
  })
  
  // Initialize AudioContext on first user interaction (click, keydown, touch)
  const initOnInteraction = () => {
    initializeAudioContext()
    // Remove listeners after first interaction
    window.removeEventListener('click', initOnInteraction)
    window.removeEventListener('keydown', initOnInteraction)
    window.removeEventListener('touchstart', initOnInteraction)
  }
  
  window.addEventListener('click', initOnInteraction, { once: true })
  window.addEventListener('keydown', initOnInteraction, { once: true })
  window.addEventListener('touchstart', initOnInteraction, { once: true })
}
