import React, { useState, useEffect, useRef } from 'react'
import { Volume2, VolumeX, Square, Palette, Settings, Mic, Smile, Heart, ThumbsUp, Zap } from 'lucide-react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { useKeyboardStore } from '../../lib/useKeyboardStore'
import { hasSkinAudio, setGlobalVolumeMultiplier } from '../../lib/audio/musicSystem'
import { setMicVolumeMultiplier, setLocalMicGain } from '../../lib/audio/voiceChatSystem'
import { isYouTubeAudioPlaying, getCurrentVideoId, stopYouTubeAudio } from '../../lib/audio/youtubePlayer'
import YouTubeModal from './YouTubeModal'
import { useSkinStore } from '../../lib/skins/skinStore'
import { useViewStore } from '../../lib/camera/viewStore'
import { useSettingsStore } from '../../lib/settings/settingsStore'

interface AudioButtonProps {
  onPlayMusic: () => void
  onStopMusic: () => void
}

// Emote keys per skin — flexible map
const SKIN_EMOTE_KEYS: Record<string, number[]> = {
  'ai16z': [3, 4, 5],
}
const DEFAULT_EMOTE_KEYS = [2, 3, 4, 5]

function getEmoteKeys(skinId: string | null): number[] {
  if (!skinId) return DEFAULT_EMOTE_KEYS
  return SKIN_EMOTE_KEYS[skinId] ?? DEFAULT_EMOTE_KEYS
}

// Icon mapping for emote keys
const EMOTE_ICONS: Record<number, React.ReactElement> = {
  2: <Smile size={18} />,
  3: <Heart size={18} />,
  4: <ThumbsUp size={18} />,
  5: <Zap size={18} />,
}

// Dispatch synthetic keydown to reuse useCameraControls emote logic
function triggerEmote(key: number) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: String(key), bubbles: true, cancelable: true }))
}

export default function AudioButton({ onPlayMusic, onStopMusic }: AudioButtonProps) {
  const { isConnected, lobbyVisible } = useMultiplayerStore()
  const { chatActive, localMicActive } = useKeyboardStore()
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false)
  const [cooldown, setCooldown] = useState(false)
  const [currentSkinId, setCurrentSkinId] = useState<string | null>(null)

  const toggleModal = useSkinStore((s) => s.toggleModal)
  const viewMode = useViewStore((s) => s.viewMode)
  const toggleViewMode = useViewStore((s) => s.toggleViewMode)
  const toggleSettings = useSettingsStore((s) => s.toggleModal)
  const toggleYouTubeModal = useSettingsStore((s) => s.toggleYouTubeModal)
  const isYouTubeModalOpen = useSettingsStore((s) => s.isYouTubeModalOpen)
  const closeYouTubeModal = useSettingsStore((s) => s.closeYouTubeModal)
  const settingsVolume = useSettingsStore((s) => s.volume)
  const settingsMicVolume = useSettingsStore((s) => s.micVolume)
  const settingsLocalMicGain = useSettingsStore((s) => s.localMicGain)

  const [isYouTubePlaying, setIsYouTubePlaying] = useState(false)

  // Sync settings → audio systems on mount and on change
  useEffect(() => {
    setGlobalVolumeMultiplier(settingsVolume / 100)
  }, [settingsVolume])

  useEffect(() => {
    setMicVolumeMultiplier(settingsMicVolume / 100)
  }, [settingsMicVolume])

  useEffect(() => {
    setLocalMicGain(settingsLocalMicGain / 100)
  }, [settingsLocalMicGain])

  const playroomRef = useRef<any>(null)

  useEffect(() => {
    if (!isConnected) return
    // @ts-ignore
    import('playroomkit').then((mod: any) => { playroomRef.current = mod })
  }, [isConnected])

  // Poll Playroom state: isMusicPlaying + skinId every 500ms
  useEffect(() => {
    if (!isConnected) return
    const interval = setInterval(() => {
      const pk = playroomRef.current
      if (!pk) return
      const player = pk.myPlayer()
      if (!player) return
      const isPlaying = player.getState('isMusicPlaying') || false
      setIsActuallyPlaying(isPlaying)
      const profile = player.getState('pdata')
      setCurrentSkinId(profile?.skinId || 'alon')
      
      // FIX FOR LOCAL POV: Sync local player's music state to the remotePlayers store
      useMultiplayerStore.getState().updateRemotePlayer(player.id, { isMusicPlaying: isPlaying })
      
      // Sync local YouTube state too (for thumbnail in third-person + HUD button)
      const ytPlaying = isYouTubeAudioPlaying()
      const ytVideoId = getCurrentVideoId()
      setIsYouTubePlaying(ytPlaying)
      useMultiplayerStore.getState().updateRemotePlayer(player.id, { 
        isYouTubePlaying: ytPlaying, 
        youtubeVideoId: ytPlaying ? ytVideoId : undefined 
      })
    }, 500)
    return () => clearInterval(interval)
  }, [isConnected])

  // M hotkey — FIX: also check input focus (fixes conflict with PlayroomKit nickname input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as any
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing || chatActive || lobbyVisible) return
      if ((e.key === 'm' || e.key === 'M') && !cooldown) {
        e.preventDefault()
        isActuallyPlaying ? handleStop() : handlePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chatActive, lobbyVisible, cooldown, isActuallyPlaying])

  const handlePlay = () => {
    if (!isConnected || cooldown) return
    if (isYouTubePlaying) return // Mutual exclusion: can't play skin music if YouTube is playing
    if (!currentSkinId || !hasSkinAudio(currentSkinId)) return
    setCooldown(true)
    onPlayMusic()
    setTimeout(() => setCooldown(false), 2000)
  }

  const handleStop = () => {
    if (!isConnected || cooldown) return
    setCooldown(true)
    onStopMusic()
    setTimeout(() => setCooldown(false), 1000)
  }

  if (!isConnected) return null

  const hasAudio = currentSkinId && hasSkinAudio(currentSkinId)
  const emoteKeys = getEmoteKeys(currentSkinId)
  const viewLabel = viewMode === 'firstPerson' ? '1P' : '3P'
  const viewTitle = viewMode === 'firstPerson' ? 'Third-person view (J)' : 'First-person view (J)'

  // Mutual exclusion: skin music disabled if YouTube playing, YouTube disabled if skin music playing
  const skinMusicDisabled = isYouTubePlaying || (!hasAudio && !isActuallyPlaying)

  return (
    <>
    <div className="hud-panel">

      {/* VIEW TOGGLE */}
      <button className="hud-btn hud-btn--view" onClick={toggleViewMode} title={viewTitle}>
        <span className="hud-btn-label">{viewLabel}</span>
      </button>

      {/* MUSIC (skin) */}
      <button
        className={`hud-btn hud-btn--music ${isActuallyPlaying ? 'is-playing' : ''} ${cooldown ? 'cooldown' : ''}`}
        onClick={isActuallyPlaying ? handleStop : handlePlay}
        disabled={cooldown || skinMusicDisabled}
        title={isYouTubePlaying ? 'Stop YouTube first' : isActuallyPlaying ? 'Stop Music (M)' : hasAudio ? 'Play Music (M)' : 'No audio for this skin'}
      >
        {isActuallyPlaying
          ? <Square size={17} fill="currentColor" />
          : hasAudio
          ? <Volume2 size={19} />
          : <VolumeX size={19} className="hud-icon-disabled" />}
      </button>

      {/* YOUTUBE MUSIC */}
      <button
        className={`hud-btn hud-btn--youtube ${isYouTubePlaying ? 'is-playing' : ''}`}
        onClick={toggleYouTubeModal}
        title={isYouTubePlaying ? 'YouTube Music playing' : 'YouTube Music'}
      >
        <img src="/youtube-icon.svg" alt="YouTube" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
      </button>

      {/* SKINS */}
      <button className="hud-btn hud-btn--skin" onClick={toggleModal} title="Change Skin (C)">
        <Palette size={19} />
      </button>

      {/* SETTINGS */}
      <button className="hud-btn hud-btn--settings" onClick={toggleSettings} title="Settings">
        <Settings size={17} />
      </button>

      {/* PUSH-TO-TALK BUTTON — click-hold or press V to talk */}
      <button
        className={`hud-btn hud-btn--mic ${localMicActive ? 'is-active' : ''}`}
        onMouseDown={async () => {
          const vc = await import('../../lib/audio/voiceChatSystem')
          if (!vc.isMicAvailable()) {
            const ok = await vc.initVoiceChat()
            if (!ok) return
            await vc.addLocalTrackToExistingPeers()
          }
          vc.startTransmitting()
          useKeyboardStore.getState().setLocalMicActive(true)
          const pk = playroomRef.current
          const me = pk?.myPlayer?.()
          if (me) me.setState('isMicActive', true)
        }}
        onMouseUp={async () => {
          const vc = await import('../../lib/audio/voiceChatSystem')
          vc.stopTransmitting()
          useKeyboardStore.getState().setLocalMicActive(false)
          const pk = playroomRef.current
          const me = pk?.myPlayer?.()
          if (me) me.setState('isMicActive', false)
        }}
        onMouseLeave={async () => {
          if (localMicActive) {
            const vc = await import('../../lib/audio/voiceChatSystem')
            vc.stopTransmitting()
            useKeyboardStore.getState().setLocalMicActive(false)
            const pk = playroomRef.current
            const me = pk?.myPlayer?.()
            if (me) me.setState('isMicActive', false)
          }
        }}
        title="Push to Talk (hold or press V)"
      >
        <Mic size={18} />
        <span className="hud-btn-sublabel">V</span>
      </button>

    </div>

    {/* YouTube Music Modal */}
    <YouTubeModal isOpen={isYouTubeModalOpen} onClose={closeYouTubeModal} />
    </>
  )
}
