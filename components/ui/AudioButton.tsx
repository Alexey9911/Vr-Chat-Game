import React, { useState, useEffect, useRef } from 'react'
import { Volume2, VolumeX, Square, Palette, Settings, Mic } from 'lucide-react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { useKeyboardStore } from '../../lib/useKeyboardStore'
import { hasSkinAudio, setGlobalVolumeMultiplier } from '../../lib/audio/musicSystem'
import { setMicVolumeMultiplier, setLocalMicGain } from '../../lib/audio/voiceChatSystem'
import { isYouTubeAudioPlaying, getCurrentVideoId, stopYouTubeAudio } from '../../lib/audio/youtubePlayer'
import YouTubeModal from './YouTubeModal'
import { useSkinStore } from '../../lib/skins/skinStore'
import { useViewStore } from '../../lib/camera/viewStore'
import { useSettingsStore } from '../../lib/settings/settingsStore'
import { cursorIntent } from '../../lib/cursorIntent'
import { requestPointerLockSafe } from '../../lib/pointerLockHelper'
import { isGeckos, setLocalState as netSetLocalState } from '../../lib/net/netClient'

interface AudioButtonProps {
  onPlayMusic: () => void
  onStopMusic: () => void
}

// NOTE: per-skin emote/dance buttons live in EmoteBar.tsx (driven by the
// central lib/skins/skinAnimations.ts config). The old duplicate emote map
// that used to live here was dead code and has been removed.

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
  const [isCursorFree, setIsCursorFree] = useState(false)
  const hudPanelRef = useRef<HTMLDivElement | null>(null)

  // Sync the .hud-panel vertical size with the WASD .controls-hud so both
  // bottoms AND tops line up. Purely visual — user complained the column
  // HUD was "ligeramente más alto" than the WASD HUD. A ResizeObserver on
  // the controls-hud keeps them matched even as the WASD panel grows /
  // shrinks (SHIFT row, hints grid, responsive tweaks, …).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const panel = hudPanelRef.current
    if (!panel) return

    const sync = () => {
      const wasd = document.querySelector('.controls-hud') as HTMLElement | null
      if (!wasd) return
      const h = wasd.getBoundingClientRect().height
      if (h > 0) panel.style.height = `${h}px`
    }

    // Initial sync once both HUDs are in the DOM.
    const raf = requestAnimationFrame(sync)

    // React to WASD HUD growing (SHIFT / hints layout, responsive rules).
    let ro: ResizeObserver | null = null
    const wasd = document.querySelector('.controls-hud') as HTMLElement | null
    if (wasd && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(sync)
      ro.observe(wasd)
    }
    // Fallback: window resize always re-measures.
    window.addEventListener('resize', sync)

    return () => {
      cancelAnimationFrame(raf)
      if (ro) ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [isConnected])

  // ESC toggles the pointer-lock (cursor lock/free). T is no longer used.
  //
  // Timeline when pointer is LOCKED and user presses ESC:
  //   1. Browser natively exits pointer-lock (we can't prevent this).
  //   2. `pointerlockchange` fires → we stamp `lastUnlockTs = now`.
  //   3. Chrome 100+ dispatches `keydown` for ESC.
  //   4. Our handler sees "unlocked < 250ms ago" → skip (user's goal was to
  //      free the cursor; don't re-lock immediately).
  //
  // Timeline when pointer is FREE and user presses ESC:
  //   1. No native browser action.
  //   2. `keydown` fires → `Date.now() - lastUnlockTs > 250` → requestPointerLock
  //      on the canvas (the keypress is a valid user gesture).
  //
  // Net behaviour: ESC acts as a real toggle. First press frees the cursor,
  // next press locks it back into the game.
  useEffect(() => {
    let lastUnlockTs = 0
    const handlePointerLockChange = () => {
      const locked: any = (document as any).pointerLockElement || (document as any).webkitPointerLockElement
      setIsCursorFree(!locked)
      if (!locked) lastUnlockTs = Date.now()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (e.repeat) { e.preventDefault(); return }
      const el = document.activeElement as any
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing) return
      if (lobbyVisible || chatActive) return
      const locked: any = (document as any).pointerLockElement || (document as any).webkitPointerLockElement
      if (locked) {
        // Let the browser handle the native ESC-exit. Don't preventDefault —
        // that would break the browser's pointer-lock release.
        cursorIntent.intentionalUnlock = true
        return
      }
      // Cursor is free. If it was just released by the browser via ESC we
      // DON'T want to immediately re-lock — that would defeat the press.
      if (Date.now() - lastUnlockTs < 350) return
      e.preventDefault()
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
      if (canvas) requestPointerLockSafe(canvas)
    }
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    document.addEventListener('webkitpointerlockchange', handlePointerLockChange as any)
    window.addEventListener('keydown', handleKey)
    const locked: any = (document as any).pointerLockElement || (document as any).webkitPointerLockElement
    setIsCursorFree(!locked)
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      document.removeEventListener('webkitpointerlockchange', handlePointerLockChange as any)
      window.removeEventListener('keydown', handleKey)
    }
  }, [lobbyVisible, chatActive])

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

  // Poll local music/skin state every 500ms to drive the HUD button (enabled/disabled + playing icon).
  useEffect(() => {
    if (!isConnected) return
    const interval = setInterval(() => {
      // geckos: there is no Playroom room — read the local player's own zustand entry (kept fresh by the
      // producers via netSetLocalState). Without this the HUD button stays permanently disabled under geckos.
      if (isGeckos()) {
        const { localPlayerId, remotePlayers } = useMultiplayerStore.getState()
        const me = localPlayerId ? remotePlayers.get(localPlayerId) : undefined
        if (!me) return
        setIsActuallyPlaying(!!me.isMusicPlaying)
        setCurrentSkinId(me.skinId || 'ansem')
        setIsYouTubePlaying(isYouTubeAudioPlaying())
        return
      }
      const pk = playroomRef.current
      if (!pk) return
      const player = pk.myPlayer()
      if (!player) return
      const isPlaying = player.getState('isMusicPlaying') || false
      setIsActuallyPlaying(isPlaying)
      const profile = player.getState('pdata')
      setCurrentSkinId(profile?.skinId || 'ansem')

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

  // NOTE: M is reserved for the lobby menu (see LobbyScreen).
  //
  // HUD hotkeys (shown as small pill badges under each icon):
  //   Y → YouTube modal
  //   U → Music play/stop ("volume" icon)
  //   I → Settings modal
  //   N → Customization / Skins modal
  //
  // Panel keys (Y / I / N) additionally release pointer-lock so the user
  // can click inside the modal immediately. Without this the cursor
  // stays captured by the canvas and the user has to press ESC first,
  // which felt broken ("abren pero no se activa el pointer"). Flagging
  // `intentionalUnlock = true` prevents the ESC listener from opening
  // the lobby on this release.
  const releasePointerForPanel = () => {
    const locked: any = (document as any).pointerLockElement || (document as any).webkitPointerLockElement
    if (!locked) return
    cursorIntent.intentionalUnlock = true
    const exit = (document as any).exitPointerLock || (document as any).webkitExitPointerLock
    exit?.call(document)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const el = document.activeElement as any
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing || chatActive || lobbyVisible) return
      const k = e.key.toLowerCase()
      if (k === 'y') {
        e.preventDefault()
        releasePointerForPanel()
        toggleYouTubeModal()
      } else if (k === 'g') {
        // Hotkey remapped from 'U' to 'G' — closer to WASD for easier reach.
        e.preventDefault()
        // Mirror the button's click handler: play if stopped, stop if playing.
        if (!cooldown && !skinMusicDisabledLive()) {
          isActuallyPlayingLive() ? handleStop() : handlePlay()
        }
      } else if (k === 'i') {
        e.preventDefault()
        releasePointerForPanel()
        toggleSettings()
      } else if (k === 'n') {
        e.preventDefault()
        releasePointerForPanel()
        toggleModal()
      }
    }
    // Helpers to read the latest playing/disabled state from the closure
    // without re-subscribing the effect on every state tick.
    const isActuallyPlayingLive = () => isActuallyPlaying
    const skinMusicDisabledLive = () => (isYouTubePlaying || (!(currentSkinId && hasSkinAudio(currentSkinId)) && !isActuallyPlaying))
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chatActive, lobbyVisible, cooldown, isActuallyPlaying, isYouTubePlaying, currentSkinId, toggleYouTubeModal, toggleSettings, toggleModal])

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

  // Mutual exclusion: skin music disabled if YouTube playing, YouTube disabled if skin music playing
  const skinMusicDisabled = isYouTubePlaying || (!hasAudio && !isActuallyPlaying)

  return (
    <>
    <div className="hud-panel" ref={hudPanelRef}>
      {/* CURSOR / ESC STATE */}
      <button
        tabIndex={-1}
        className={`hud-btn hud-btn--cursor ${isCursorFree ? 'is-free' : ''}`}
        onClick={() => {
          if (isCursorFree) {
            const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
            if (canvas) requestPointerLockSafe(canvas)
          } else {
            cursorIntent.intentionalUnlock = true
            const exit = (document as any).exitPointerLock || (document as any).webkitExitPointerLock
            exit?.call(document)
          }
        }}
        title={isCursorFree ? "Cursor Free (press ESC or click canvas to lock)" : "Cursor Locked (press ESC to free)"}
      >
        <span style={{ fontSize: '17px', fontWeight: 900, letterSpacing: '1.2px' }}>ESC</span>
      </button>

      {/* LOBBY MENU (M) */}
      <button
        tabIndex={-1}
        className="hud-btn hud-btn--menu"
        onClick={() => {
          const s = useMultiplayerStore.getState()
          s.setLobbyVisible(!s.lobbyVisible)
        }}
        title="Open/Close Menu (M)"
      >
        <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '1.2px' }}>M</span>
      </button>

      {/* MUSIC (skin) */}
      <button
        tabIndex={-1}
        className={`hud-btn hud-btn--music ${isActuallyPlaying ? 'is-playing' : ''} ${cooldown ? 'cooldown' : ''}`}
        onClick={isActuallyPlaying ? handleStop : handlePlay}
        disabled={cooldown || skinMusicDisabled}
        title={isYouTubePlaying ? 'Stop YouTube first' : isActuallyPlaying ? 'Stop Music (G)' : hasAudio ? 'Play Music (G)' : 'No audio for this skin'}
      >
        {isActuallyPlaying
          ? <Square size={22} fill="currentColor" />
          : hasAudio
          ? <Volume2 size={24} />
          : <VolumeX size={24} className="hud-icon-disabled" />}
        <span className="hud-btn-hotkey">G</span>
      </button>

      {/* YOUTUBE MUSIC */}
      <button
        tabIndex={-1}
        className={`hud-btn hud-btn--youtube ${isYouTubePlaying ? 'is-playing' : ''}`}
        onClick={toggleYouTubeModal}
        title={isYouTubePlaying ? 'YouTube Music playing (Y)' : 'YouTube Music (Y)'}
      >
        <img src="/youtube-icon.svg" alt="YouTube" draggable={false} />
        <span className="hud-btn-hotkey">Y</span>
      </button>

      {/* SKINS / CUSTOMIZATION */}
      <button tabIndex={-1} className="hud-btn hud-btn--skin" onClick={toggleModal} title="Change Skin (N)">
        <Palette size={24} />
        <span className="hud-btn-hotkey">N</span>
      </button>

      {/* SETTINGS */}
      <button tabIndex={-1} className="hud-btn hud-btn--settings" onClick={toggleSettings} title="Settings (I)">
        <Settings size={22} />
        <span className="hud-btn-hotkey">I</span>
      </button>

      {/* PUSH-TO-TALK BUTTON — click-hold or press V to talk */}
      <button
        tabIndex={-1}
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
          if (isGeckos()) {
            netSetLocalState({ isMicActive: true })
          } else {
            const me = playroomRef.current?.myPlayer?.()
            if (me) me.setState('isMicActive', true)
          }
        }}
        onMouseUp={async () => {
          const vc = await import('../../lib/audio/voiceChatSystem')
          vc.stopTransmitting()
          useKeyboardStore.getState().setLocalMicActive(false)
          if (isGeckos()) {
            netSetLocalState({ isMicActive: false })
          } else {
            const me = playroomRef.current?.myPlayer?.()
            if (me) me.setState('isMicActive', false)
          }
        }}
        onMouseLeave={async () => {
          if (localMicActive) {
            const vc = await import('../../lib/audio/voiceChatSystem')
            vc.stopTransmitting()
            useKeyboardStore.getState().setLocalMicActive(false)
            if (isGeckos()) {
              netSetLocalState({ isMicActive: false })
            } else {
              const me = playroomRef.current?.myPlayer?.()
              if (me) me.setState('isMicActive', false)
            }
          }
        }}
        title="Push to Talk (hold or press V)"
      >
        <Mic size={23} />
        <span className="hud-btn-sublabel">V</span>
      </button>

    </div>

    {/* YouTube Music Modal */}
    <YouTubeModal isOpen={isYouTubeModalOpen} onClose={closeYouTubeModal} />
    </>
  )
}
