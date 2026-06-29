import React, { useState, useEffect, useRef } from 'react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { checkAdminURL, getAdminProfile, setAdminStatus } from '../../lib/auth/adminAuth'
import { useKeyboardStore } from '../../lib/useKeyboardStore'
import AdminPasswordModal from './AdminPasswordModal'
import { parseEmoteCodes, getEmoteById } from '../../lib/emotes/emotesConfig'
import { useSettingsStore, type EnvironmentPreset } from '../../lib/settings/settingsStore'
import { setGlobalVolumeMultiplier, stopMusicForPlayer } from '../../lib/audio/musicSystem'
import { setMicVolumeMultiplier, setLocalMicGain as setLocalMicGainAudio } from '../../lib/audio/voiceChatSystem'
import { SKINS } from '../../lib/skins/skinsConfig'
import { useSkinStore } from '../../lib/skins/skinStore'
import type { SkinColors } from '../../lib/skins/skinTypes'
import SkinPreviewCanvas from '../skins/SkinPreviewCanvas'
import { playYouTubeAudio, stopYouTubeAudio, isYouTubeAudioPlaying, getCurrentVideoTitle, setYouTubeVolume } from '../../lib/audio/youtubePlayer'
import { cursorIntent } from '../../lib/cursorIntent'
import { isImpersonationNick } from '../../lib/moderation/nickGuard'
import {
  isGeckos,
  connect as netConnect,
  disconnect as netDisconnect,
  onPeerJoin as netOnPeerJoin,
  onPeerLeave as netOnPeerLeave,
  setLocalState as netSetLocalState,
  setMediaStartEpoch as netSetMediaStartEpoch,
  sendVoiceSignal as netSendVoiceSignal,
  GECKOS_LOBBY,
} from '../../lib/net/netClient'

const ENVIRONMENT_OPTIONS: { value: EnvironmentPreset; label: string; description: string }[] = [
  { value: 'sunset', label: 'Sunset', description: 'Warm golden hour lighting' },
  { value: 'night', label: 'Night', description: 'Dark starry sky' },
  { value: 'warehouse', label: 'Warehouse', description: 'Indoor studio lighting' },
]

const PALETTE_COLORS = [
  { label: 'Electric Blue', hex: '#4a9eff' },
  { label: 'Crimson', hex: '#ff3b3b' },
  { label: 'Neon Green', hex: '#39ff14' },
  { label: 'Gold', hex: '#ffd700' },
  { label: 'Purple', hex: '#a855f7' },
  { label: 'Hot Pink', hex: '#ff6ec7' },
  { label: 'Cyan', hex: '#00e5ff' },
  { label: 'Orange', hex: '#ff6b00' },
  { label: 'White', hex: '#ffffff' },
  { label: 'Shadow', hex: '#1a1a2e' },
  { label: 'Lime', hex: '#7fff00' },
  { label: 'Magenta', hex: '#ff00ff' },
]

// Lobby / Skin selection screen — shown before entering the 3D world
// Player chooses nickname and color (skin), then clicks Play

const SKIN_COLORS = [
  { name: 'Blue', hex: '#4a9eff' },
  { name: 'Red', hex: '#ff4a4a' },
  { name: 'Green', hex: '#4aff7e' },
  { name: 'Purple', hex: '#b44aff' },
  { name: 'Orange', hex: '#ff8c4a' },
  { name: 'Pink', hex: '#ff4aa8' },
  { name: 'Yellow', hex: '#ffd94a' },
  { name: 'Cyan', hex: '#4affec' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Black', hex: '#333333' },
]

// Format timestamp as [HH:MM:SS] in 24h
function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  return `[${hh}:${mm}:${ss}]`
}

function InlineGif({ url }: { url: string }) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const giphyMatch = url.match(/media\.giphy\.com\/media\/([a-zA-Z0-9]+)\//)
  const pageUrl = giphyMatch ? `https://giphy.com/gifs/${giphyMatch[1]}` : url
  return (
    <span
      className="chat-gif-inline-wrapper"
      onMouseEnter={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setMousePos(null)}
    >
      <a href={pageUrl} target="_blank" rel="noopener noreferrer">
        <img src={url} alt="GIF" className="chat-gif-inline-thumb" title="Click to open GIF" />
      </a>
      {mousePos && (
        <div
          className="chat-gif-inline-expand"
          style={{
            position: 'fixed',
            left: mousePos.x + 12,
            top: Math.max(8, mousePos.y - 260),
            transform: 'none',
            bottom: 'auto',
          }}
        >
          <img src={url} alt="GIF expanded" />
        </div>
      )}
    </span>
  )
}

export default function LobbyScreen() {
  const {
    lobbyVisible,
    setLobbyVisible,
    setConnected,
    setIsAdmin,
    setCurrentLobby,
    chatMessages,
    setChatMessages,
    isConnected,
  } = useMultiplayerStore()

  // Settings store (real wired state)
  const settingsVolume = useSettingsStore((s) => s.volume)
  const settingsMicVolume = useSettingsStore((s) => s.micVolume)
  const settingsLocalMicGain = useSettingsStore((s) => s.localMicGain)
  const environment = useSettingsStore((s) => s.environment)
  const setVolume = useSettingsStore((s) => s.setVolume)
  const setMicVolume = useSettingsStore((s) => s.setMicVolume)
  const setLocalMicGainStore = useSettingsStore((s) => s.setLocalMicGain)
  const setEnvironment = useSettingsStore((s) => s.setEnvironment)

  // Skin store (live 3D preview)
  const selectedSkinIndex = useSkinStore((s) => s.selectedSkinIndex)
  const colorsBySkinId = useSkinStore((s) => s.colorsBySkinId)
  const setSelectedSkinIndex = useSkinStore((s) => s.setSelectedSkinIndex)
  const setSkinColors = useSkinStore((s) => s.setSkinColors)
  const setActiveSkinId = useSkinStore((s) => s.setActiveSkinId)
  const setSkinLoaded = useSkinStore((s) => s.setSkinLoaded)
  const [activeTab, setActiveTab] = useState('LOBBY')
  const [ytUrl, setYtUrl] = useState('')
  const [ytPlaying, setYtPlaying] = useState(false)
  const [ytTitle, setYtTitle] = useState('')
  const [ytLoading, setYtLoading] = useState(false)
  const [ytError, setYtError] = useState('')
  const [nickname, setNickname] = useState('')
  const [audioContextInitialized, setAudioContextInitialized] = useState(false)
  const [selectedColor, setSelectedColor] = useState(SKIN_COLORS[0].hex)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [autoJoinNickname, setAutoJoinNickname] = useState<string | null>(null)
  const hasInitialized = useRef(false)
  const localPlayerIdRef = useRef<string | null>(null)
  // Menu background video: poster (kf1) shows instantly, the looping muted
  // video fades in once it can play. `videoReady` drives the cross-fade.
  const [videoReady, setVideoReady] = useState(false)
  const bgVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const isAutoJoin = urlParams.get('autoJoin') === 'true'

    // Check if admin URL param is present
    if (checkAdminURL()) {
      if (isAutoJoin) {
        // Auto-join: skip password modal and use stored nickname
        const storedNickname = sessionStorage.getItem('adminNickname')
        
        if (storedNickname) {
          setIsAdminMode(true)
          setIsAdmin(true)
          setAutoJoinNickname(storedNickname)
          setNickname(storedNickname)
        } else {
          setShowAdminModal(true)
        }
        
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname + '?admin=admin')
      } else {
        // First time admin access - show password modal
        setShowAdminModal(true)
      }
    } else if (isAutoJoin) {
      // Regular user redirected from full lobby
      const storedNickname = sessionStorage.getItem('playerNickname')
      const storedColor = sessionStorage.getItem('playerColor')
      if (storedNickname) {
        setNickname(storedNickname)
        if (storedColor) setSelectedColor(storedColor)
        setAutoJoinNickname(storedNickname) // triggers auto-join effect
      }
      window.history.replaceState({}, '', window.location.pathname)
    }

    // Cleanup on tab close: tell API player left
    // Use multiple events for reliability — pagehide is most reliable in modern browsers
    let hasLeft = false
    const handleLeave = () => {
      if (hasLeft || !localPlayerIdRef.current) return
      hasLeft = true
      if (isGeckos()) {
        // geckos: cleanly leave the relay (server broadcasts a `leave` to peers). No Deno-KV registry.
        try { netDisconnect() } catch {}
        return
      }
    }
    window.addEventListener('beforeunload', handleLeave)
    window.addEventListener('pagehide', handleLeave)
    window.addEventListener('unload', handleLeave)

    return () => {
      window.removeEventListener('beforeunload', handleLeave)
      window.removeEventListener('pagehide', handleLeave)
      window.removeEventListener('unload', handleLeave)
    }
  }, [])

  // M ↔ toggle lobby menu (open AND close).
  //
  // Simplified design (replaces the old ESC + pointerlockchange combo which
  // was fragile and collided with Alt+Tab / window-blur / Chrome's native
  // pointer-lock exit). Now the mapping is:
  //   M     → toggle lobby menu (JS-controlled, predictable).
  //   ESC   → browser-native pointer-lock release ONLY (frees the cursor).
  //   T     → same as ESC via JS (kept for muscle memory / mobile).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'm' && e.key !== 'M') return
      if (e.repeat) { e.preventDefault(); return }
      const el = document.activeElement as any
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing) return
      if (useKeyboardStore.getState().chatActive) return
      if (!isConnected) return
      e.preventDefault()
      const nextVisible = !lobbyVisible
      setLobbyVisible(nextVisible)
      if (!nextVisible) {
        // Closing the lobby — re-lock camera synchronously so the camera
        // responds without needing an extra click on the canvas.
        lockCanvas()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [isConnected, lobbyVisible, setLobbyVisible])

  // Toggle <body class="in-lobby"> so the CSS can tile the lobby background
  // across the full viewport (avoids ugly black letterbox bars on >FHD monitors).
  useEffect(() => {
    document.body.classList.toggle('in-lobby', lobbyVisible)
    return () => { document.body.classList.remove('in-lobby') }
  }, [lobbyVisible])

  // Keep the menu background video playing whenever the lobby is visible —
  // including when it's re-opened with M after entering the game. It's muted
  // + looped so autoplay is always allowed; restart from the top on each open
  // so the menu always greets you with the cinematic from the beginning.
  useEffect(() => {
    const v = bgVideoRef.current
    if (!v) return
    if (lobbyVisible) {
      try { v.currentTime = 0 } catch {}
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [lobbyVisible, videoReady])

  // Poll YouTube playback state while on the CUSTOMIZATION tab
  useEffect(() => {
    if (activeTab !== 'CUSTOMIZATION') return
    const t = setInterval(() => {
      setYtPlaying(isYouTubeAudioPlaying())
      setYtTitle(getCurrentVideoTitle())
    }, 500)
    return () => clearInterval(t)
  }, [activeTab])

  // Keep YouTube volume in sync with music slider
  useEffect(() => { setYouTubeVolume(settingsVolume / 100) }, [settingsVolume])

  // FIX — Clear local YT UI when the video ends naturally. youtubePlayer
  // dispatches `yt-ended` from the YT iframe's ENDED state change and also
  // resets net state so remotes drop the embed cover image; this hook
  // keeps THIS client's own Customization tab in sync so the input re-enables
  // and the "now playing" banner disappears without a manual Stop click.
  useEffect(() => {
    const onEnded = () => {
      setYtPlaying(false)
      setYtTitle('')
      setYtError('')
    }
    window.addEventListener('yt-ended', onEnded as any)
    return () => window.removeEventListener('yt-ended', onEnded as any)
  }, [])

  // Initialize audio context on first user interaction
  const initAudioOnInteraction = () => {
    if (!audioContextInitialized) {
      import('../../lib/audio/musicSystem').then(({ initializeAudioContext }) => {
        initializeAudioContext()
        setAudioContextInitialized(true)
      })
    }
  }

  // Helper: request pointer lock on the actual <canvas> element.
  // useCameraControls checks `pointerLockElement === canvas`, so locking
  // document.body would be accepted by the browser but ignored by the
  // camera — camera wouldn't move. We MUST target the canvas.
  //
  // Safari prefixes pointer-lock APIs with `webkit`; handle both.
  const lockCanvas = () => {
    const canvas = document.querySelector('canvas') as any
    if (!canvas) return
    const cur: any = (document as any).pointerLockElement || (document as any).webkitPointerLockElement
    if (cur === canvas) return
    try {
      const req = canvas.requestPointerLock || canvas.webkitRequestPointerLock || canvas.mozRequestPointerLock
      req?.call(canvas)
    } catch {}
  }

  // geckos single-lobby connect (no Playroom, no 10-per-lobby split). Active when NEXT_PUBLIC_NET=geckos.
  // Wires the existing WebRTC mesh voice's signaling through the geckos `voice` channel (copied from GTA-PORT),
  // and lets netClient's reconciler drive remotes + the late-join music sync.
  const handleGeckosPlay = async () => {
    setError('')
    // Spawn with the skin the player picked in the lobby (LobbyCenterSkinPicker
    // updates selectedSkinIndex). Previously this was hardcoded to 'ansem', so
    // the lobby selection was ignored and everyone entered as ansem.
    const lobbySkin = SKINS[selectedSkinIndex] ?? SKINS[0]
    const profile = isAdminMode
      ? getAdminProfile(nickname.trim())
      : {
          name: nickname.trim(),
          color: selectedColor,
          skinId: lobbySkin.id,
          isAdmin: false,
          colors: { primary: selectedColor },
        }

    setIsConnecting(true)
    try {
      if (!hasInitialized.current) {
        hasInitialized.current = true

        // Voice signaling over geckos — wire BEFORE connect so the first discovered peers can hand-shake.
        const vc = await import('../../lib/audio/voiceChatSystem')
        vc.setRpcSender((event: string, data: any) => netSendVoiceSignal(event, data))
        vc.setLocalPlayerIdGetter(() => useMultiplayerStore.getState().localPlayerId || null)
        netOnPeerJoin((peerId) => {
          if (!vc.hasPeer(peerId)) Promise.resolve(vc.createOffer(peerId)).catch(() => {})
        })
        netOnPeerLeave((peerId) => vc.removePeer(peerId))

        // Inbound voice signaling (SDP/ICE) → the mesh handlers. Passed INTO connect so it's registered
        // before join (a fast peer's answer/ICE could otherwise arrive before a post-connect registration).
        const id = await netConnect(nickname.trim(), profile, (from, signal) => {
          if (signal.kind === 'offer') vc.handleOffer(from, signal.sdp || '')
          else if (signal.kind === 'answer') vc.handleAnswer(from, signal.sdp || '')
          else if (signal.candidate) vc.handleIceCandidate(from, signal.candidate)
        })
        localPlayerIdRef.current = id

        // Push-to-talk (V) — identical UX to Playroom; the mic flag rides geckos PlayerState (isMicActive).
        const handleVoiceKeyDown = async (e: KeyboardEvent) => {
          if (e.key !== 'v' && e.key !== 'V') return
          const el = document.activeElement as any
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
          if (e.repeat) return
          const vcc = await import('../../lib/audio/voiceChatSystem')
          if (!vcc.isMicAvailable()) {
            const ok = await vcc.initVoiceChat()
            if (!ok) return
            await vcc.addLocalTrackToExistingPeers()
            useMultiplayerStore.getState().remotePlayers.forEach((_, peerId) => {
              if (peerId !== id && !vcc.hasPeer(peerId)) vcc.createOffer(peerId)
            })
          }
          vcc.startTransmitting()
          useKeyboardStore.getState().setLocalMicActive(true)
          netSetLocalState({ isMicActive: true })
        }
        const handleVoiceKeyUp = async (e: KeyboardEvent) => {
          if (e.key !== 'v' && e.key !== 'V') return
          const vcc = await import('../../lib/audio/voiceChatSystem')
          vcc.stopTransmitting()
          useKeyboardStore.getState().setLocalMicActive(false)
          netSetLocalState({ isMicActive: false })
        }
        window.addEventListener('keydown', handleVoiceKeyDown)
        window.addEventListener('keyup', handleVoiceKeyUp)

        // Single fixed lobby — currentLobby is only the Neon chat partition key now.
        setCurrentLobby(GECKOS_LOBBY as any)
        import('../../lib/lobbyApi').then(({ getChatHistory }) => {
          getChatHistory(GECKOS_LOBBY).then((history) => {
            if (history && history.length > 0) setChatMessages(history)
          })
        })
      }
    } catch (err) {
      hasInitialized.current = false
      setIsConnecting(false)
      setError('Could not connect. Try again.')
      return
    }
    setIsConnecting(false)

    if (isAdminMode && profile.name) {
      sessionStorage.setItem('adminNickname', profile.name.replace('[ADMIN] ', ''))
    }
    // netConnect already set localPlayerId + seeded the profile entry; just enter the world.
    setConnected(true)
    setLobbyVisible(false)
    lockCanvas()
  }

  // Finalize player profile and enter the game
  const handlePlayClick = async () => {
    initAudioOnInteraction()
    // If already in-game (lobby was reopened via ESC), just close the overlay
    // and re-lock the canvas synchronously (this click is a valid user gesture).
    if (isConnected) {
      setError('')
      setLobbyVisible(false)
      lockCanvas()
      return
    }
    if (!nickname.trim()) {
      setError('Please enter a nickname!')
      return
    }
    // Block authority-impersonation nicks up front (admin/dev/mod/staff/official…). UX guard;
    // the relay still 1-min-bans a patched client that bypasses this. Authenticated admins
    // (isAdminMode) are exempt — their [ADMIN] prefix is added after password auth.
    if (!isAdminMode && isImpersonationNick(nickname.trim())) {
      setError('That nickname is not allowed')
      return
    }

    // geckos single-lobby path — bypass Playroom + the lobby-split entirely.
    if (isGeckos()) {
      await handleGeckosPlay()
      return
    }
  }

  const handleAdminSuccess = () => {
    setShowAdminModal(false)
    setIsAdminMode(true)
    setIsAdmin(true)
    setAdminStatus(true)
  }

  const handleAdminCancel = () => {
    setShowAdminModal(false)
    setIsAdminMode(false)
    // Clear URL param
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }

  // Auto-join effect: admin lobby switch OR regular user redirect from full lobby
  useEffect(() => {
    if (autoJoinNickname) {
      setTimeout(() => {
        handlePlayClick()
      }, 500)
    }
  }, [autoJoinNickname])

  // Show admin password modal if admin URL detected (takes over UI)
  if (showAdminModal) {
    return <AdminPasswordModal onSuccess={handleAdminSuccess} onCancel={handleAdminCancel} />
  }

  return (
    <div className={`lobby-overlay ${lobbyVisible ? 'is-visible' : 'is-hidden'}`} aria-hidden={!lobbyVisible}>
      {/* Background: poster (kf1) shows instantly while the cinematic loads,
          then the looping MUTED video cross-fades in. A light filter layer on
          top keeps the menu readable (vignette + contrast). */}
      <img
        className={`lobby-video-bg lobby-bg-poster ${videoReady ? 'is-faded' : ''}`}
        src="/menu-poster.png"
        alt=""
      />
      <video
        ref={bgVideoRef}
        className={`lobby-video-bg lobby-bg-video ${videoReady ? 'is-shown' : ''}`}
        src="/menu-bg.mp4"
        poster="/menu-poster.png"
        muted
        loop
        autoPlay
        playsInline
        preload="auto"
        onCanPlay={() => setVideoReady(true)}
      />
      <div className="lobby-video-bg lobby-bg-filter" aria-hidden="true" />
      
      {/* Top Navbar */}
      <div className="lobby-top-bar">
        <div className="lobby-brand">
          <h1 className="lobby-title">Ansem House</h1>
          <p className="lobby-subtitle-concept">3D SOCIAL WORLD</p>
        </div>
        <div className="lobby-nav-tabs">
          {['LOBBY', 'CUSTOMIZATION', 'AUDIO SETTINGS', 'VIDEO SETTINGS', 'CONTROLS'].map(tab => (
            <button key={tab} className={`nav-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <div className="lobby-top-right">
          <div className="top-stat"><span style={{color: '#10b981', marginRight: '5px'}}>●</span> NODE SYNCED</div>
          <div className="top-stat" style={{color: '#f1c40f', fontWeight: 'bold', letterSpacing: '1px'}}>EARLY ACCESS</div>
          <img src="/elonkiss.png" alt="" style={{width: '45px', height: '45px', objectFit: 'contain', filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.2))', marginLeft: '10px', borderRadius: '50%'}} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lobby-main">
        {activeTab === 'LOBBY' ? (
          <>
            {/* Left Sidebar */}
            <div className="lobby-left-panel">
              <div className="info-box season-box">
                 <div className="season-header">CURRENT LOCATION <span className="blue-diamond">💎</span></div>
                 <div className="level-info">
                   <div className="level-shield">🌐</div>
                   <div className="level-text">
                     <span className="lvl-big">Ansem House</span>
                     <span className="xp-text">LOBBY 1</span>
                   </div>
                 </div>
              </div>
              
              <div className="info-box battlepass-box">
                 <div className="box-title bg-red">FEATURES</div>
                 <div className="box-desc">
                   • Proximity Voice Chat (V)<br/>
                   • Custom GIFs search<br/>
                   • Emotes & Animations<br/>
                   • Customizable Skins
                 </div>
              </div>

              <div className="info-box daily-box">
                 <div className="box-title bg-purple">CONTROLS</div>
                 <div className="box-desc bg-teal">
                   WASD to Move<br/>
                   ENTER to Text Chat<br/>
                   HOLD V for Voice Chat
                 </div>
              </div>
              {/* Skin color selection */}
              <div className="info-box skin-picker-box">
                 <label className="lobby-label text-orange">CHOOSE YOUR SKIN COLOR</label>
                 <div className="lobby-colors">
                   {SKIN_COLORS.map((skin) => (
                     <button
                       key={skin.hex}
                       className={`lobby-color-btn ${selectedColor === skin.hex ? 'selected' : ''}`}
                       style={{ backgroundColor: skin.hex }}
                       onClick={() => setSelectedColor(skin.hex)}
                       title={skin.name}
                     />
                   ))}
                 </div>
              </div>
            </div>

            {/* Center - Characters & Nickname */}
            <div className="lobby-center-panel">
               {/* Live 3D skin preview replacing the old static avatar.png.
                   Identical pattern to CustomizationTab (SkinPreviewCanvas +
                   ‹ / › arrows) but inlined here so it's the first thing the
                   player sees. State flows through useSkinStore, so any change
                   here is immediately reflected in:
                     - CustomizationTab (same store)
                     - SkinBar (bottom in-game HUD)
                     - SkinsModal (C key in-game)
                     - geckos PlayerState `skinId` → remote avatars
                   No duplicated logic: `applyLobbySkin` mirrors CustomizationTab.applyProfile. */}
               <LobbyCenterSkinPicker
                 selectedSkinIndex={selectedSkinIndex}
                 colorsBySkinId={colorsBySkinId}
                 setSelectedSkinIndex={setSelectedSkinIndex}
                 setActiveSkinId={setActiveSkinId}
                 setSkinLoaded={setSkinLoaded}
               />

               {/* Mobile-only skin picker */}
               <div className="info-box mobile-skin-picker" style={{display: 'none', marginBottom: '15px'}}>
                 <div className="lobby-colors" style={{justifyContent: 'center', flexWrap: 'wrap'}}>
                   {SKIN_COLORS.map((skin) => (
                     <button
                       key={`mobile-${skin.hex}`}
                       className={`lobby-color-btn ${selectedColor === skin.hex ? 'selected' : ''}`}
                       style={{ backgroundColor: skin.hex, width: '30px', height: '30px', margin: '2px' }}
                       onClick={() => setSelectedColor(skin.hex)}
                       title={skin.name}
                     />
                   ))}
                 </div>
               </div>

               <div className="nickname-container">
                 <div className="crown-icon">👑</div>
                 <input
                   type="text"
                   value={nickname}
                   onChange={(e) => {
                     initAudioOnInteraction()
                     setNickname(e.target.value)
                   }}
                   placeholder="ENTER NICKNAME"
                   maxLength={16}
                   className="fortnite-input"
                   autoFocus
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') handlePlayClick()
                   }}
                 />
                 <div className={`status-text ${nickname ? 'ready' : 'not-ready'}`}>
                   {nickname ? 'READY' : 'NOT READY'}
                 </div>
                 {error && <p className="lobby-error">{error}</p>}
               </div>

               {/* PLAY button — centered under nickname */}
               <button
                 className="lobby-play-btn"
                 onClick={handlePlayClick}
                 disabled={isConnecting}
                 style={{ marginTop: 20 }}
               >
                 PLAY
               </button>
            </div>

            {/* Right Sidebar */}
            <div className="lobby-right-panel">
                <div className="lobby-chat-preview">
                  <div className="lobby-chat-title">SERVER CHAT</div>
                  {chatMessages.length === 0 && <div className="chat-empty" style={{color: 'rgba(255,255,255,0.3)', margin: 'auto'}}>Connecting to chat...</div>}
                  {chatMessages.slice(-8).map((msg) => {
                    const parts = parseEmoteCodes(msg.text)
                    return (
                      <div key={msg.id} style={{fontSize: '12px', lineHeight: '1.3', marginBottom: '2px'}}>
                        <span style={{color: msg.playerColor || '#f1c40f', fontWeight: 'bold'}}>{msg.playerName}: </span>
                        <span style={{color: 'white'}}>
                          {parts.map((part, index) => {
                            if (part.type === 'emote') {
                              const emote = getEmoteById(part.content)
                              if (emote) {
                                if (emote.type === 'video') {
                                  return (
                                    <video key={index} src={emote.url} className="chat-emote-inline" autoPlay loop muted playsInline title={emote.name} />
                                  )
                                }
                                return (
                                  <img
                                    key={index}
                                    src={emote.url}
                                    alt={emote.name}
                                    className="chat-emote-inline"
                                    title={emote.name}
                                  />
                                )
                              }
                            }
                            if (part.type === 'klipy' && part.url) {
                              return <InlineGif key={index} url={part.url} />
                            }
                            return <span key={index}>{part.content}</span>
                          })}
                        </span>
                      </div>
                    )
                  })}
               </div>
               
               {/* PLAYING IN — dropped to the bottom of the right panel since the
                   PLAY button moved to the center column. */}
               <div className="play-section play-section--compact">
                  <div className="game-mode">
                    <span className="mode-title">PLAYING IN</span>
                    <span className="mode-name">Ansem House</span>
                  </div>
               </div>
            </div>
          </>
        ) : (
          <div className="lobby-settings-container" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            {activeTab === 'CUSTOMIZATION' && (
              <CustomizationTab
                isConnected={isConnected}
                ytUrl={ytUrl} setYtUrl={setYtUrl}
                ytPlaying={ytPlaying} ytTitle={ytTitle}
                ytLoading={ytLoading} setYtLoading={setYtLoading}
                ytError={ytError} setYtError={setYtError}
                setYtPlaying={setYtPlaying} setYtTitle={setYtTitle}
                selectedSkinIndex={selectedSkinIndex}
                colorsBySkinId={colorsBySkinId}
                setSelectedSkinIndex={setSelectedSkinIndex}
                setSkinColors={setSkinColors}
                setActiveSkinId={setActiveSkinId}
                setSkinLoaded={setSkinLoaded}
              />
            )}

            {activeTab === 'AUDIO SETTINGS' && (
              <div className="settings-ui-panel">
                <div className="setting-item">
                  <h3>Music Volume</h3>
                  <p>Volume of skin music and YouTube in the game</p>
                  <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                     <input
                       type="range" min="0" max="100"
                       value={settingsVolume}
                       onChange={(e) => {
                         const v = Number(e.target.value)
                         setVolume(v)
                         setGlobalVolumeMultiplier(v / 100)
                         setYouTubeVolume(v / 100)
                       }}
                       className="fortnite-slider"
                     />
                     <span style={{color: 'white', fontWeight: 'bold', width: '50px'}}>{settingsVolume}%</span>
                  </div>
                </div>
                <div className="setting-item">
                  <h3>Other Players Mic</h3>
                  <p>How loud you hear other players' microphones</p>
                  <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                     <input
                       type="range" min="0" max="100"
                       value={settingsMicVolume}
                       onChange={(e) => {
                         const v = Number(e.target.value)
                         setMicVolume(v)
                         setMicVolumeMultiplier(v / 100)
                       }}
                       className="fortnite-slider"
                     />
                     <span style={{color: 'white', fontWeight: 'bold', width: '50px'}}>{settingsMicVolume}%</span>
                  </div>
                </div>
                <div className="setting-item">
                  <h3>Your Microphone</h3>
                  <p>How loud other players hear you</p>
                  <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                     <input
                       type="range" min="0" max="100"
                       value={settingsLocalMicGain}
                       onChange={(e) => {
                         const v = Number(e.target.value)
                         setLocalMicGainStore(v)
                         setLocalMicGainAudio(v / 100)
                       }}
                       className="fortnite-slider"
                     />
                     <span style={{color: 'white', fontWeight: 'bold', width: '50px'}}>{settingsLocalMicGain}%</span>
                  </div>
                </div>
                <MicPermissionRow />
                <div className="setting-item">
                  <h3>YouTube Music</h3>
                  <p>Paste a YouTube URL in the CUSTOMIZATION tab to share music with everyone in the lobby.</p>
                </div>
              </div>
            )}
            
            {activeTab === 'VIDEO SETTINGS' && (
              <div className="settings-ui-panel">
                <div className="setting-item">
                  <h3>Environment</h3>
                  <p>Change the lighting and atmosphere</p>
                  <div style={{display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap'}}>
                    {ENVIRONMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className="lobby-play-btn"
                        onClick={() => setEnvironment(opt.value)}
                        style={{
                          fontSize: '18px',
                          padding: '15px 24px',
                          animation: 'none',
                          background: opt.value === 'night'
                            ? 'linear-gradient(45deg, #111, #333)'
                            : opt.value === 'warehouse'
                            ? 'linear-gradient(45deg, #1DA1F2, #00f2fe)'
                            : 'linear-gradient(45deg, #f89b29, #ff0f7b)',
                          outline: environment === opt.value ? '3px solid #f1c40f' : 'none',
                          opacity: environment === opt.value ? 1 : 0.75,
                        }}
                        title={opt.description}
                      >
                        {opt.label.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'CONTROLS' && (
              <div className="settings-ui-panel">
                <div className="setting-item">
                  <h3>KEYBOARD BINDINGS</h3>
                  <p>Quick reference for in-game actions</p>
                </div>
                <div className="control-row"><span>ESC</span> <span>Toggle this Lobby (pause)</span></div>
                <div className="control-row"><span>T</span> <span>Toggle mouse cursor (free / lock)</span></div>
                <div className="control-row"><span>Click</span> <span>Lock mouse to camera</span></div>
                <div className="control-row"><span>C</span> <span>Change Skins Panel</span></div>
                <div className="control-row"><span>V</span> <span>Hold to Voice Chat</span></div>
                <div className="control-row"><span>W A S D</span> <span>Move Character</span></div>
                <div className="control-row"><span>SPACE</span> <span>Jump</span></div>
                <div className="control-row"><span>1 2 3 4</span> <span>Play Emotes</span></div>
                <div className="control-row"><span>G</span> <span>Play / Stop Music</span></div>
                <div className="control-row"><span>Y</span> <span>YouTube Music</span></div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Bottom Bar */}
      <div className="lobby-bottom-bar">
         <div style={{ display: 'flex', gap: '15px' }}>
            <a href="https://x.com/a1onverse" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="news-btn pulse-effect" style={{ background: '#1DA1F2', color: 'white', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 0 15px rgba(29, 161, 242, 0.4)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg> 
                TWITTER
              </button>
            </a>
            <a href="https://pump.fun/coin/0x000000" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="news-btn pulse-effect" style={{ background: '#10b981', color: 'white', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)' }}>
                <img src="/icons/pumpfun.png" alt="PumpFun" className="news-icon" /> 
                PUMP.FUN
              </button>
            </a>
         </div>
         <div className="bottom-social">
            <div className="server-status">
              <div className="blink-dot"></div>
              SERVER ONLINE
            </div>
            <div className="friends-avatars">
            </div>
         </div>
      </div>

    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// MIC PERMISSION ROW — lives inside Audio Settings tab
// Detects current browser permission state and lets the user enable it.
// ───────────────────────────────────────────────────────────────────
function MicPermissionRow() {
  const [state, setState] = React.useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown')
  const [busy, setBusy] = React.useState(false)

  const refresh = React.useCallback(async () => {
    // Try the Permissions API first (Chromium, Firefox)
    try {
      const perms: any = (navigator as any).permissions
      if (perms?.query) {
        const res = await perms.query({ name: 'microphone' as PermissionName })
        setState(res.state as any)
        res.onchange = () => setState((res.state as any))
        return
      }
    } catch {}
    // Fallback: check if our voice chat module already has a track
    try {
      const vc = await import('../../lib/audio/voiceChatSystem')
      setState(vc.isMicAvailable() ? 'granted' : 'prompt')
    } catch {
      setState('prompt')
    }
  }, [])

  React.useEffect(() => { refresh() }, [refresh])

  const handleEnable = async () => {
    setBusy(true)
    try {
      const vc = await import('../../lib/audio/voiceChatSystem')
      const ok = await vc.initVoiceChat()
      setState(ok ? 'granted' : 'denied')
    } catch {
      setState('denied')
    } finally {
      setBusy(false)
    }
  }

  const label =
    state === 'granted' ? '✅ Microphone enabled — press and hold V to talk'
    : state === 'denied' ? '⛔ Microphone blocked by browser — allow it from the site permissions (padlock icon in the URL bar)'
    : '🎙️ Microphone not enabled — turn it on to use voice chat (V key)'

  return (
    <div className="setting-item">
      <h3>Microphone</h3>
      <p>{label}</p>
      {state !== 'granted' && (
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            onClick={handleEnable}
            disabled={busy || state === 'denied'}
            className="lobby-play-btn"
            style={{
              fontSize: 15,
              padding: '10px 18px',
              animation: 'none',
              background: state === 'denied'
                ? 'linear-gradient(45deg, #555, #777)'
                : 'linear-gradient(45deg, #10b981, #059669)',
              opacity: busy || state === 'denied' ? 0.6 : 1,
              cursor: busy || state === 'denied' ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Requesting…' : state === 'denied' ? 'BLOCKED' : 'TURN ON MIC'}
          </button>
          <button
            onClick={refresh}
            className="lobby-play-btn"
            style={{
              fontSize: 13, padding: '10px 14px', animation: 'none',
              background: 'linear-gradient(45deg, #374151, #1f2937)',
            }}
            title="Re-check permission"
          >
            REFRESH
          </button>
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// LOBBY CENTER SKIN PICKER — 3D preview + arrows shown in the middle
// panel of the lobby (replaces the old /avatar.png static image).
// Shares state with CustomizationTab / SkinsModal / SkinBar via
// useSkinStore, and pushes skin changes to remotes via the same
// profile-update path used by CustomizationTab.applyProfile.
// ───────────────────────────────────────────────────────────────────
type LobbyCenterSkinPickerProps = {
  selectedSkinIndex: number
  colorsBySkinId: Record<string, SkinColors | undefined>
  setSelectedSkinIndex: (i: number) => void
  setActiveSkinId: (id: string) => void
  setSkinLoaded: (id: string, loaded: boolean) => void
}

function LobbyCenterSkinPicker(props: LobbyCenterSkinPickerProps) {
  const {
    selectedSkinIndex, colorsBySkinId,
    setSelectedSkinIndex, setActiveSkinId, setSkinLoaded,
  } = props

  const skin = SKINS[selectedSkinIndex] ?? SKINS[0]
  const colors = colorsBySkinId[skin.id]
  // Live load state for the currently-shown skin — used to render the
  // spinner overlay while the KTX2 GLB is still downloading/decoding.
  // Re-uses the exact same flag SkinsModal does, so the two UIs agree.
  const isSkinLoaded = useSkinStore((s) => !!s.loadBySkinId[skin.id]?.loaded)

  // Prefetch prev + next skins so arrow clicks are instant.
  const neighborUrls = React.useMemo(() => {
    const n = SKINS.length
    if (n <= 1) return [] as string[]
    const prev = SKINS[(selectedSkinIndex - 1 + n) % n]
    const next = SKINS[(selectedSkinIndex + 1) % n]
    const urls = [prev.assets.modelUrl, next.assets.modelUrl]
    prev.assets.lodModelUrls?.forEach((u) => urls.push(u))
    next.assets.lodModelUrls?.forEach((u) => urls.push(u))
    return Array.from(new Set(urls))
  }, [selectedSkinIndex])

  function applyLobbySkin(nextIndex: number) {
    const nextSkin = SKINS[nextIndex] ?? SKINS[0]
    const nextColors = colorsBySkinId[nextSkin.id]

    setSelectedSkinIndex(nextIndex)
    setActiveSkinId(nextSkin.id)

    if (isGeckos()) {
      const { localPlayerId, remotePlayers, updateRemotePlayer } = useMultiplayerStore.getState()
      if (localPlayerId) {
        const prev = remotePlayers.get(localPlayerId)
        const color = nextColors?.primary ?? prev?.color ?? '#4a9eff'
        updateRemotePlayer(localPlayerId, { skinId: nextSkin.id, colors: nextColors ?? prev?.colors, color })
      }
    }
  }

  function onPrev() {
    const n = SKINS.length
    if (n <= 1) return
    applyLobbySkin((selectedSkinIndex - 1 + n) % n)
  }
  function onNext() {
    const n = SKINS.length
    if (n <= 1) return
    applyLobbySkin((selectedSkinIndex + 1) % n)
  }

  return (
    <div
      style={{
        position: 'relative',
        width: 360,
        height: 400,
        marginBottom: 10,
        // Soft green glow to echo the old avatar.png drop-shadow.
        filter: 'drop-shadow(0 0 15px rgba(74,222,128,0.35))',
      }}
    >
      {/* Transparent 3D preview — same component used by the Customization
          tab and the in-game SkinsModal, so animations / camera framing
          are guaranteed to match. `key={skin.id}` forces a clean re-mount
          between skins (no leftover animation actions or mixer state). */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <SkinPreviewCanvas
          key={skin.id}
          skin={skin}
          colors={colors}
          neighborUrls={neighborUrls}
          transparent
          onLoaded={() => setSkinLoaded(skin.id, true)}
        />
      </div>

      {/* Loading spinner until the active skin's GLB finishes decoding.
          Without this the lobby briefly shows an empty frame where the
          old static avatar.png used to be — now replaced by a clean
          centered spinner until `onLoaded` flips the store flag. */}
      {!isSkinLoaded && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 2,
        }}>
          <div className="spinner" style={{ width: 48, height: 48 }} />
        </div>
      )}

      {/* Left / right arrows — big, centered, readable. */}
      <button
        type="button"
        onClick={onPrev}
        disabled={SKINS.length <= 1}
        aria-label="Previous skin"
        style={{
          position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          border: '2px solid rgba(255,255,255,0.35)',
          color: '#fff', fontSize: 30, lineHeight: '1', cursor: 'pointer',
          zIndex: 3, padding: 0,
        }}
      >‹</button>
      <button
        type="button"
        onClick={onNext}
        disabled={SKINS.length <= 1}
        aria-label="Next skin"
        style={{
          position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          border: '2px solid rgba(255,255,255,0.35)',
          color: '#fff', fontSize: 30, lineHeight: '1', cursor: 'pointer',
          zIndex: 3, padding: 0,
        }}
      >›</button>

      {/* Skin name + index counter — top so it's readable above the model. */}
      <div style={{
        position: 'absolute', top: 8, left: 0, right: 0,
        textAlign: 'center', zIndex: 2, pointerEvents: 'none',
        color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.85)',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.7 }}>
          {selectedSkinIndex + 1} / {SKINS.length}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>
          {skin.label}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// CUSTOMIZATION TAB — embedded skin picker (transparent canvas) + YouTube
// ───────────────────────────────────────────────────────────────────
type CustomizationProps = {
  isConnected: boolean
  ytUrl: string; setYtUrl: (s: string) => void
  ytPlaying: boolean; ytTitle: string
  ytLoading: boolean; setYtLoading: (b: boolean) => void
  ytError: string; setYtError: (s: string) => void
  setYtPlaying: (b: boolean) => void; setYtTitle: (s: string) => void
  selectedSkinIndex: number
  colorsBySkinId: Record<string, SkinColors | undefined>
  setSelectedSkinIndex: (i: number) => void
  setSkinColors: (id: string, c: SkinColors) => void
  setActiveSkinId: (id: string) => void
  setSkinLoaded: (id: string, loaded: boolean) => void
}

function CustomizationTab(props: CustomizationProps) {
  const {
    isConnected, ytUrl, setYtUrl, ytPlaying, ytTitle,
    ytLoading, setYtLoading, ytError, setYtError,
    setYtPlaying, setYtTitle,
    selectedSkinIndex, colorsBySkinId,
    setSelectedSkinIndex, setSkinColors, setActiveSkinId, setSkinLoaded,
  } = props

  const skin = SKINS[selectedSkinIndex] ?? SKINS[0]
  const colors = colorsBySkinId[skin.id]
  const showPalette = skin.paletteSupport === 'customizable'
  const neighborUrls = React.useMemo(() => {
    const n = SKINS.length
    if (n <= 1) return [] as string[]
    const prev = SKINS[(selectedSkinIndex - 1 + n) % n]
    const next = SKINS[(selectedSkinIndex + 1) % n]
    const urls = [prev.assets.modelUrl, next.assets.modelUrl]
    prev.assets.lodModelUrls?.forEach((u) => urls.push(u))
    next.assets.lodModelUrls?.forEach((u) => urls.push(u))
    return Array.from(new Set(urls))
  }, [selectedSkinIndex])

  async function applyProfile(nextIndex: number, nextColors: SkinColors | undefined) {
    const nextSkin = SKINS[nextIndex] ?? SKINS[0]
    if (isGeckos()) {
      const { localPlayerId, remotePlayers, updateRemotePlayer } = useMultiplayerStore.getState()
      if (localPlayerId) {
        const prev = remotePlayers.get(localPlayerId)
        const color = nextColors?.primary ?? prev?.color ?? '#4a9eff'
        updateRemotePlayer(localPlayerId, { skinId: nextSkin.id, colors: nextColors ?? prev?.colors, color })
      }
      setActiveSkinId(nextSkin.id)
      return
    }
  }

  function changeIndex(nextIndex: number) {
    setSelectedSkinIndex(nextIndex)
    void applyProfile(nextIndex, colorsBySkinId[SKINS[nextIndex]?.id ?? ''])
  }

  function onPrev() {
    const n = SKINS.length
    if (n <= 1) return
    changeIndex((selectedSkinIndex - 1 + n) % n)
  }
  function onNext() {
    const n = SKINS.length
    if (n <= 1) return
    changeIndex((selectedSkinIndex + 1) % n)
  }
  function updateColors(patch: SkinColors) {
    setSkinColors(skin.id, patch)
    void applyProfile(selectedSkinIndex, { ...(colorsBySkinId[skin.id] ?? {}), ...patch })
  }

  const handlePlayYt = async () => {
    setYtError('')
    if (!ytUrl.trim()) return
    setYtLoading(true)
    try {
      if (isGeckos()) {
        const localId = useMultiplayerStore.getState().localPlayerId
        if (localId) stopMusicForPlayer(localId)
        const info = await playYouTubeAudio(ytUrl)
        setYtTitle(info.title)
        setYtPlaying(true)
        netSetMediaStartEpoch(Date.now())
        netSetLocalState({ isYouTubePlaying: true, youtubeVideoId: info.videoId, isMusicPlaying: false })
        return
      }
    } catch (err: any) {
      setYtError(err?.message || 'Failed to play YouTube audio')
    } finally {
      setYtLoading(false)
    }
  }

  const handleStopYt = () => {
    stopYouTubeAudio()
    setYtPlaying(false)
    setYtTitle('')
    setYtError('')
    if (isGeckos()) {
      netSetMediaStartEpoch(undefined)
      netSetLocalState({ isYouTubePlaying: false, youtubeVideoId: undefined })
      return
    }
  }

  return (
    <div className="settings-ui-panel" style={{ width: '100%', maxWidth: 1100, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
      {/* LEFT: 3D SKIN PREVIEW (transparent canvas) */}
      <div style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        minHeight: 420,
        background: 'transparent',
      }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <SkinPreviewCanvas
            skin={skin}
            colors={colors}
            neighborUrls={neighborUrls}
            transparent
            onLoaded={() => setSkinLoaded(skin.id, true)}
          />
        </div>
        {/* Nav arrows */}
        <button
          type="button"
          onClick={onPrev}
          disabled={SKINS.length <= 1}
          aria-label="Previous skin"
          style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.45)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)', borderRadius: '50%',
            width: 44, height: 44, fontSize: 22, cursor: 'pointer', zIndex: 2,
          }}
        >‹</button>
        <button
          type="button"
          onClick={onNext}
          disabled={SKINS.length <= 1}
          aria-label="Next skin"
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.45)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)', borderRadius: '50%',
            width: 44, height: 44, fontSize: 22, cursor: 'pointer', zIndex: 2,
          }}
        >›</button>
        {/* Label */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 10, textAlign: 'center',
          color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.8)', zIndex: 2,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.7 }}>
            {selectedSkinIndex + 1} / {SKINS.length}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{skin.label}</div>
        </div>
      </div>

      {/* RIGHT: options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="setting-item">
          <h3>Your Skin</h3>
          <p>Use ‹ / › to switch between skins. Changes are saved to your profile instantly.</p>
        </div>

        {showPalette && (
          <div className="setting-item">
            <h3>Colors</h3>
            <p>Personalize your skin with a color</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {PALETTE_COLORS.map(({ label, hex }) => (
                <button
                  key={hex}
                  onClick={() => updateColors({ primary: hex })}
                  title={label}
                  style={{
                    width: 34, height: 34, borderRadius: '50%',
                    border: colors?.primary === hex ? '3px solid #f1c40f' : '2px solid rgba(255,255,255,0.3)',
                    background: hex, cursor: 'pointer', padding: 0,
                    boxShadow: colors?.primary === hex ? '0 0 12px rgba(241,196,15,0.6)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* YouTube Music */}
        <div className="setting-item">
          <h3>🎵 YouTube Music</h3>
          <p>Paste a YouTube URL — everyone in the lobby will hear it. Volume follows Music slider.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              type="text"
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !ytPlaying) handlePlayYt() }}
              placeholder="https://youtube.com/watch?v=..."
              disabled={!isConnected || ytLoading || ytPlaying}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, padding: '10px 12px',
                color: '#fff', fontSize: 13, outline: 'none',
              }}
            />
            {ytPlaying ? (
              <button
                onClick={handleStopYt}
                style={{
                  background: 'rgba(255,0,0,0.2)', border: '1px solid rgba(255,0,0,0.5)',
                  borderRadius: 8, padding: '10px 16px', color: '#ff6b6b',
                  fontWeight: 700, cursor: 'pointer',
                }}
              >Stop</button>
            ) : (
              <button
                onClick={handlePlayYt}
                disabled={!isConnected || ytLoading || !ytUrl.trim()}
                style={{
                  background: 'rgba(255,0,0,0.25)', border: '1px solid rgba(255,0,0,0.5)',
                  borderRadius: 8, padding: '10px 16px', color: ytLoading ? '#888' : '#ff6b6b',
                  fontWeight: 700, cursor: ytLoading ? 'wait' : 'pointer',
                  opacity: !isConnected || ytLoading || !ytUrl.trim() ? 0.5 : 1,
                }}
              >{ytLoading ? 'Loading…' : 'Play'}</button>
            )}
          </div>
          {!isConnected && (
            <div style={{ fontSize: 12, color: '#ffb84d', marginTop: 6 }}>
              Join the lobby first to share music.
            </div>
          )}
          {ytError && (
            <div style={{ fontSize: 12, color: '#ff6b6b', marginTop: 6 }}>{ytError}</div>
          )}
          {ytPlaying && ytTitle && (
            <div style={{
              marginTop: 10, padding: '8px 12px',
              background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)',
              borderRadius: 8, color: '#ffaaaa', fontSize: 13,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              ▶ {ytTitle}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
