import React, { useState, useEffect, useRef } from 'react'
import { RPC } from 'playroomkit'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { checkAdminURL, getAdminProfile, setAdminStatus } from '../../lib/auth/adminAuth'
import { MAX_PLAYERS_PER_LOBBY, getLobbyIndex, generateLobbyCode, isValidLobbyCode } from '../../lib/lobbyConfig'
import { findLobby, joinLobby, leaveLobby } from '../../lib/lobbyApi'
import { useKeyboardStore } from '../../lib/useKeyboardStore'
import AdminPasswordModal from './AdminPasswordModal'
import { parseEmoteCodes, getEmoteById } from '../../lib/emotes/emotesConfig'

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
    setLocalPlayerId, 
    updateRemotePlayer, 
    removeRemotePlayer, 
    addChatMessage,
    setIsAdmin,
    setCurrentLobby,
    chatMessages,
    setChatMessages,
    remotePlayers,
  } = useMultiplayerStore()
  const [activeTab, setActiveTab] = useState('LOBBY')
  const [nickname, setNickname] = useState('')
  const [audioContextInitialized, setAudioContextInitialized] = useState(false)
  const [selectedColor, setSelectedColor] = useState(SKIN_COLORS[0].hex)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [autoJoinNickname, setAutoJoinNickname] = useState<string | null>(null)
  const [connectingLobby, setConnectingLobby] = useState<string | null>(null)
  const [showMicStep, setShowMicStep] = useState(false)
  const [micStatus, setMicStatus] = useState<'pending' | 'granted' | 'denied' | 'skipped'>('pending')
  const playroomRef = useRef<any>(null)
  const hasInitialized = useRef(false)
  const localPlayerIdRef = useRef<string | null>(null)

  useEffect(() => {
    // @ts-ignore — playroomkit will be available after npm install
    import('playroomkit').then((mod: any) => {
      playroomRef.current = mod
      initBackgroundConnection(mod)
    })

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
      leaveLobby(localPlayerIdRef.current)
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

  // Initialize audio context on first user interaction
  const initAudioOnInteraction = () => {
    if (!audioContextInitialized) {
      import('../../lib/audio/musicSystem').then(({ initializeAudioContext }) => {
        initializeAudioContext()
        setAudioContextInitialized(true)
      })
    }
  }

  // Finalize player profile and enter the game 
  const handlePlayClick = () => {
    initAudioOnInteraction()
    if (!nickname.trim()) {
      setError('Please enter a nickname!')
      return
    }
    const pk = playroomRef.current
    if (!pk || !pk.myPlayer()) {
      setError('Wait for server connection...')
      return
    }
    setError('')
    setShowMicStep(true)

    const me = pk.myPlayer()
    const profile = isAdminMode 
      ? getAdminProfile(nickname.trim())
      : {
          name: nickname.trim(),
          color: selectedColor,
          skinId: 'alon',
          isAdmin: false,
          colors: { primary: selectedColor },
        }
    
    me.setState('pdata', profile)
    setLocalPlayerId(me.id)

    if (isAdminMode && profile.name) {
      const cleanName = profile.name.replace('[ADMIN] ', '')
      sessionStorage.setItem('adminNickname', cleanName)
    }

    updateRemotePlayer(me.id, {
      id: me.id,
      name: profile.name,
      color: profile.color,
      skinId: profile.skinId,
      isAdmin: profile.isAdmin,
      colors: profile.colors,
    })

    setConnected(true)
    setLobbyVisible(false)
  }

  // Step 2: Handle mic permission from the friendly UI
  const handleMicEnable = async () => {
    try {
      const vc = await import('../../lib/audio/voiceChatSystem')
      const ok = await vc.initVoiceChat()
      setMicStatus(ok ? 'granted' : 'denied')
      // Auto-hide modal after short feedback (world already loading)
      setTimeout(() => setShowMicStep(false), 800)
    } catch {
      setMicStatus('denied')
      setTimeout(() => setShowMicStep(false), 800)
    }
  }

  const handleMicSkip = () => {
    setMicStatus('skipped')
    setShowMicStep(false)
  }

  // Background connection for live chat and state sync
  const initBackgroundConnection = async (providedPk?: any) => {
    try {
      const pk = providedPk || playroomRef.current
      if (!pk) return

      if (!hasInitialized.current) {
        hasInitialized.current = true
        
        // Step 1: Determine which lobby to join
        let lobbyCode: string
        
        const adminTargetLobby = sessionStorage.getItem('targetLobby')
        const redirectLobby = sessionStorage.getItem('redirectLobby')
        
        if (adminTargetLobby && isAdminMode) {
          // Admin targeting a specific room
          sessionStorage.removeItem('targetLobby')
          lobbyCode = adminTargetLobby
          console.log(`[Lobby] Admin targeting: ${lobbyCode}`)
        } else if (redirectLobby) {
          // Redirected from a full lobby — use the next lobby directly
          sessionStorage.removeItem('redirectLobby')
          sessionStorage.removeItem('playerNickname')
          sessionStorage.removeItem('playerColor')
          lobbyCode = redirectLobby
          console.log(`[Lobby] Redirected to: ${lobbyCode}`)
        } else {
          // Check if URL has a specific lobby param (e.g. ?lobby=AlonHouse-2)
          const urlParams = new URLSearchParams(window.location.search)
          const urlLobby = urlParams.get('lobby')
          
          if (urlLobby && isValidLobbyCode(urlLobby)) {
            lobbyCode = urlLobby
            console.log(`[Lobby] Joining specific lobby from URL: ${lobbyCode}`)
          } else {
            // Ask the API: "which lobby has space?"
            console.log('[Lobby] Asking API for available lobby...')
            const lobbyInfo = await findLobby()
            lobbyCode = lobbyInfo.code
            console.log(`[Lobby] API says: ${lobbyCode} (${lobbyInfo.players}/${lobbyInfo.max})`)
          }
        }
        
        setCurrentLobby(lobbyCode)
        setConnectingLobby(lobbyCode)
        
        // Step 2: Connect to PlayroomKit with the EXACT room code
        try {
          await pk.insertCoin({
            skipLobby: true,
            roomCode: lobbyCode,
            maxPlayersPerRoom: isAdminMode ? MAX_PLAYERS_PER_LOBBY + 1 : MAX_PLAYERS_PER_LOBBY,
          })
        } catch (insertErr: any) {
          const errMsg = insertErr?.message || String(insertErr)
          if (errMsg.includes('ROOM_LIMIT') || errMsg.includes('room') || errMsg.includes('full')) {
            // Room is actually full — redirect to next lobby
            const nextIndex = getLobbyIndex(lobbyCode) + 1
            const nextLobby = generateLobbyCode(nextIndex)
            console.log(`[Lobby] ${lobbyCode} full (PlayroomKit), redirecting to ${nextLobby}...`)
            
            sessionStorage.setItem('playerNickname', nickname.trim())
            sessionStorage.setItem('playerColor', selectedColor)
            sessionStorage.setItem('redirectLobby', nextLobby)
            
            const url = new URL(window.location.href)
            url.search = ''
            url.searchParams.set('autoJoin', 'true')
            if (isAdminMode) {
              url.searchParams.set('admin', 'admin')
              sessionStorage.setItem('adminNickname', nickname.trim())
            }
            
            window.location.href = url.toString()
            return // Page is reloading
          }
          throw insertErr // Re-throw unknown errors
        }
        
        // Step 3: Register in API after successful connection
        const me = pk.myPlayer()
        if (me) {
          localPlayerIdRef.current = me.id
          await joinLobby(me.id, lobbyCode)
          console.log(`[Lobby] Registered ${me.id} in ${lobbyCode}`)
        }
        
        // Update URL
        window.history.replaceState({}, '', `${window.location.pathname}?lobby=${lobbyCode}`)
        console.log(`[Lobby] Successfully joined ${lobbyCode}`)

        // Step 4: Fetch chat history for preview before entering game
        import('../../lib/lobbyApi').then(({ getChatHistory }) => {
          getChatHistory(lobbyCode).then((history) => {
            if (history && history.length > 0) {
              setChatMessages(history)
            }
          })
        })
      }

      // Player profile initialization moved to handlePlayClick mapping

      // Register RPC for synchronized music playback
      RPC.register('playMusic', async (data: any, caller: any) => {
        const { playerId, skinId } = data
        
        try {
          const { playMusicForPlayer } = await import('../../lib/audio/musicSystem')
          playMusicForPlayer(playerId, skinId)
          
          if (caller) {
            caller.setState('isMusicPlaying', true)
            caller.setState('musicData', {
              skinId: skinId,
              startTime: Date.now()
            })
          }
        } catch (err) {
        }
      })

      // Register RPC to stop music across all players
      RPC.register('stopMusic', async (data: any, caller: any) => {
        const { playerId } = data
        try {
          const { stopMusicForPlayer } = await import('../../lib/audio/musicSystem')
          stopMusicForPlayer(playerId)
          if (caller) {
            caller.setState('isMusicPlaying', false)
            caller.setState('musicData', null)
          }
        } catch (err) {
        }
      })

      // --- Voice Chat RPC Handlers ---
      RPC.register('voiceOffer', async (data: any) => {
        const { from, to, sdp } = data
        if (to !== pk.myPlayer()?.id) return
        const vc = await import('../../lib/audio/voiceChatSystem')
        vc.handleOffer(from, sdp)
      })
      RPC.register('voiceAnswer', async (data: any) => {
        const { from, to, sdp } = data
        if (to !== pk.myPlayer()?.id) return
        const vc = await import('../../lib/audio/voiceChatSystem')
        vc.handleAnswer(from, sdp)
      })
      RPC.register('voiceIce', async (data: any) => {
        const { from, to, candidate } = data
        if (to !== pk.myPlayer()?.id) return
        const vc = await import('../../lib/audio/voiceChatSystem')
        vc.handleIceCandidate(from, candidate)
      })

      // Initialize voice chat system with RPC sender
      import('../../lib/audio/voiceChatSystem').then((vc) => {
        vc.setRpcSender((event: string, data: any) => {
          RPC.call(event, data, RPC.Mode.ALL)
        })
        vc.setLocalPlayerIdGetter(() => pk.myPlayer()?.id || null)
      })

      // Push-to-talk: V key
      const handleVoiceKeyDown = async (e: KeyboardEvent) => {
        if (e.key === 'v' || e.key === 'V') {
          // Skip if typing in input
          const el = document.activeElement as any
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
          if (e.repeat) return // Ignore key repeat
          const vc = await import('../../lib/audio/voiceChatSystem')
          if (!vc.isMicAvailable()) {
            const ok = await vc.initVoiceChat()
            if (!ok) return
            await vc.addLocalTrackToExistingPeers()
            const remotePlayers = useMultiplayerStore.getState().remotePlayers
            remotePlayers.forEach((_, peerId) => {
              if (!vc.hasPeer(peerId)) vc.createOffer(peerId)
            })
          }
          vc.startTransmitting()
          useKeyboardStore.getState().setLocalMicActive(true)
          const me = pk.myPlayer()
          if (me) me.setState('isMicActive', true)
        }
      }
      const handleVoiceKeyUp = async (e: KeyboardEvent) => {
        if (e.key === 'v' || e.key === 'V') {
          const vc = await import('../../lib/audio/voiceChatSystem')
          vc.stopTransmitting()
          useKeyboardStore.getState().setLocalMicActive(false)
          const me = pk.myPlayer()
          if (me) me.setState('isMicActive', false)
        }
      }
      window.addEventListener('keydown', handleVoiceKeyDown)
      window.addEventListener('keyup', handleVoiceKeyUp)

      // onPlayerJoin — identical to playroom_guide/Experience.jsx lines 23-38
      pk.onPlayerJoin((state: any) => {
        // Skip processing our own state — ChatInput handles the local player
        if (state.id === pk.myPlayer()?.id) return
        
        const seenChatTimestamps = new Set<number>()

        // CRITICAL FIX: Don't create player entry until profile is ready
        const initialProfile = state.getState('pdata')
        
        if (initialProfile?.name) {
          updateRemotePlayer(state.id, {
            id: state.id,
            name: initialProfile.name,
            color: initialProfile.color || '#4a9eff',
            skinId: initialProfile.skinId || 'alon',
            isAdmin: initialProfile.isAdmin || false,
            colors: initialProfile.colors || { primary: initialProfile.color || '#4a9eff' },
          })
        } else {
        }

        // Track music sync state to prevent duplicate plays
        const musicSyncedFor = new Set<string>()
        let wasMusicPlaying = false

        // Track YouTube sync state
        const ytSyncedFor = new Set<string>()
        let wasYouTubePlaying = false

        // Cache dynamic imports once
        let musicMod: any = null
        let ytMod: any = null
        import('../../lib/audio/musicSystem').then((m) => { musicMod = m })
        import('../../lib/audio/youtubePlayer').then((m) => { ytMod = m })
        
        // Poll remote player positions (OPTIMIZED: single updateRemotePlayer call per tick)
        const posInterval = setInterval(() => {
          const pos = state.getState('pos')
          const rotY = state.getState('rotY')
          const profile = state.getState('pdata')
          const chatData = state.getState('chatMessage')
          const anim = state.getState('animation')
          const isMusicPlaying = state.getState('isMusicPlaying')
          const musicData = state.getState('musicData')
          const isYouTubePlaying = state.getState('isYouTubePlaying')
          const youtubeData = state.getState('youtubeData')

          if (pos) {
            const update: any = {
              position: pos,
              rotationY: rotY || 0,
              animation: anim || null,
            }
            if (profile && profile.name) {
              update.name = profile.name
              update.color = profile.color || '#4a9eff'
              update.skinId = profile.skinId
              update.isAdmin = profile.isAdmin || false
              update.colors = profile.colors
              update.isMusicPlaying = isMusicPlaying || false
              update.isYouTubePlaying = isYouTubePlaying || false
              update.youtubeVideoId = youtubeData?.videoId || undefined
              update.isMicActive = state.getState('isMicActive') || false
            }
            updateRemotePlayer(state.id, update)
          }
          
          // Sync music ONCE when new player joins and music is playing
          if (isMusicPlaying && musicData && musicData.skinId) {
            wasMusicPlaying = true
            const syncKey = `${state.id}-${musicData.skinId}-${musicData.startTime}`
            if (!musicSyncedFor.has(syncKey)) {
              musicSyncedFor.add(syncKey)
              const elapsed = Date.now() - (musicData.startTime || 0)
              if (musicMod) {
                musicMod.playMusicForPlayer(state.id, musicData.skinId, elapsed / 1000)
              }
            }
          } else if (!isMusicPlaying) {
            if (wasMusicPlaying) {
              wasMusicPlaying = false
              if (musicMod && musicMod.isPlayingForPlayer(state.id)) {
                musicMod.stopMusicForPlayer(state.id)
              }
            }
            musicSyncedFor.clear()
          }

          // Sync YouTube music ONCE when remote player is playing
          if (isYouTubePlaying && youtubeData && youtubeData.videoId) {
            wasYouTubePlaying = true
            const ytSyncKey = `${state.id}-${youtubeData.videoId}-${youtubeData.startTime}`
            if (!ytSyncedFor.has(ytSyncKey)) {
              ytSyncedFor.add(ytSyncKey)
              const elapsed = Date.now() - (youtubeData.startTime || 0)
              if (ytMod) {
                ytMod.playYouTubeForPlayer(state.id, youtubeData.videoId, elapsed / 1000)
              }
            }
          } else if (!isYouTubePlaying) {
            if (wasYouTubePlaying) {
              wasYouTubePlaying = false
              if (ytMod && ytMod.isYouTubePlayingForPlayer(state.id)) {
                ytMod.stopYouTubeForPlayer(state.id)
              }
            }
            ytSyncedFor.clear()
          }

          // Handle chat bubbles (state-based instead of RPC)
          if (chatData && chatData.text && chatData.timestamp) {
            if (!seenChatTimestamps.has(chatData.timestamp)) {
              seenChatTimestamps.add(chatData.timestamp)
              updateRemotePlayer(state.id, { chatMessage: chatData.text })
              addChatMessage({
                id: chatData.timestamp.toString() + '-' + state.id,
                playerId: state.id,
                playerName: profile?.name || 'Player',
                playerColor: profile?.colors?.primary || profile?.color || '#ffb84d',
                text: chatData.text,
                timestamp: chatData.timestamp,
              })
              setTimeout(() => {
                updateRemotePlayer(state.id, { chatMessage: null })
              }, 5000)
            }
          }
        }, 100) // 10 FPS sync

        // When a new player joins, always create voice peer connection (receive-only if no mic)
        import('../../lib/audio/voiceChatSystem').then((vc) => {
          if (!vc.hasPeer(state.id)) {
            vc.createOffer(state.id)
          }
        })

        state.onQuit(() => {
          clearInterval(posInterval)
          musicSyncedFor.clear()
          removeRemotePlayer(state.id)
          import('../../lib/audio/voiceChatSystem').then((vc) => vc.removePeer(state.id))
        })
      })

      // Background connection ready

      // Cleanup voice chat on unmount
      return () => {
        window.removeEventListener('keydown', handleVoiceKeyDown)
        window.removeEventListener('keyup', handleVoiceKeyUp)
        import('../../lib/audio/voiceChatSystem').then((vc) => vc.cleanupVoiceChat())
      }
    } catch (err: any) {
      // Background connection failure - silent
      hasInitialized.current = false // reset so they can try again
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
    if (autoJoinNickname && playroomRef.current) {
      setTimeout(() => {
        handlePlayClick()
      }, 500)
    }
  }, [autoJoinNickname])

  if (!lobbyVisible) return null

  // Show admin password modal if admin URL detected
  if (showAdminModal) {
    return <AdminPasswordModal onSuccess={handleAdminSuccess} onCancel={handleAdminCancel} />
  }

  return (
    <div className="lobby-overlay">
      {/* Background image - Clean, no filters */}
      <img
        className="lobby-video-bg"
        src="/alonVersion/image.png"
        alt=""
      />
      
      {/* Top Navbar */}
      <div className="lobby-top-bar">
        <div className="lobby-brand">
          <h1 className="lobby-title">$AlonVerse</h1>
          <p className="lobby-subtitle-concept">3D SOCIAL WORLD</p>
        </div>
        <div className="lobby-nav-tabs">
          {['LOBBY', 'AUDIO SETTINGS', 'VIDEO SETTINGS', 'CONTROLS'].map(tab => (
            <button key={tab} className={`nav-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>
        <div className="lobby-top-right">
          <div className="top-stat"><span style={{color: '#10b981', marginRight: '5px'}}>●</span> NODE SYNCED</div>
          <div className="top-stat" style={{color: '#f1c40f', fontWeight: 'bold', letterSpacing: '1px'}}>EARLY ACCESS</div>
          <img src="/elonkiss.png" alt="AlonHouse" style={{width: '45px', height: '45px', objectFit: 'contain', filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.2))', marginLeft: '10px', borderRadius: '50%'}} />
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
                     <span className="lvl-big">ALONVERSE</span>
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
               {/* Logo / PFP in center - positioned above nickname */}
               <img 
                  src="/avatar.png" 
                  alt="AlonHouse Avatar" 
                  style={{ width: '300px', height: '300px', objectFit: 'contain', marginBottom: '20px', filter: 'drop-shadow(0 0 15px rgba(241,196,15,0.6))' }} 
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
               
               <div className="play-section">
                  <div className="game-mode">
                    <span className="mode-title">PLAYING IN</span>
                    <span className="mode-name">ALONVERSE</span>
                  </div>
                  <button 
                    className="lobby-play-btn" 
                    onClick={handlePlayClick}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                       <span className="lobby-loading">CONNECTING...</span>
                    ) : (
                       'PLAY'
                    )}
                  </button>
               </div>
            </div>
          </>
        ) : (
          <div className="lobby-settings-container" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            {activeTab === 'AUDIO SETTINGS' && (
              <div className="settings-ui-panel">
                <div className="setting-item">
                  <h3>YouTube</h3>
                  <p>Everyone in the lobby will hear the music • Volume follows Music slider</p>
                </div>
                <div className="setting-item">
                  <h3>Music Volume</h3>
                  <p>Volume of skin music in the game</p>
                  <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                     <input type="range" min="0" max="100" defaultValue="50" className="fortnite-slider" />
                     <span style={{color: 'white', fontWeight: 'bold', width: '50px'}}>50%</span>
                  </div>
                </div>
                <div className="setting-item">
                  <h3>Other Players Mic</h3>
                  <p>How loud you hear other players' microphones</p>
                  <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                     <input type="range" min="0" max="100" defaultValue="100" className="fortnite-slider" />
                     <span style={{color: 'white', fontWeight: 'bold', width: '50px'}}>100%</span>
                  </div>
                </div>
                <div className="setting-item">
                  <h3>Your Microphone</h3>
                  <p>How loud other players hear you</p>
                  <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                     <input type="range" min="0" max="100" defaultValue="100" className="fortnite-slider" />
                     <span style={{color: 'white', fontWeight: 'bold', width: '50px'}}>100%</span>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'VIDEO SETTINGS' && (
              <div className="settings-ui-panel">
                <div className="setting-item">
                  <h3>Environment</h3>
                  <p>Change the lighting and atmosphere</p>
                  <div style={{display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap'}}>
                     <button className="lobby-play-btn" style={{fontSize: '20px', padding: '15px 30px', animation: 'none', background: 'linear-gradient(45deg, #1DA1F2, #00f2fe)'}}>DAY</button>
                     <button className="lobby-play-btn" style={{fontSize: '20px', padding: '15px 30px', animation: 'none', filter: 'grayscale(1)', background: 'linear-gradient(45deg, #111, #333)'}}>NIGHT</button>
                     <button className="lobby-play-btn" style={{fontSize: '20px', padding: '15px 30px', animation: 'none', filter: 'grayscale(0.6)', background: 'linear-gradient(45deg, #f89b29, #ff0f7b)'}}>SUNSET</button>
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
                <div className="control-row"><span>C</span> <span>Change Skins Panel</span></div>
                <div className="control-row"><span>V</span> <span>Hold to Voice Chat</span></div>
                <div className="control-row"><span>W A S D</span> <span>Move Character</span></div>
                <div className="control-row"><span>SPACE</span> <span>Jump</span></div>
                <div className="control-row"><span>1 2 3 4</span> <span>Play Emotes</span></div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Bottom Bar */}
      <div className="lobby-bottom-bar">
         <div style={{ display: 'flex', gap: '15px' }}>
            <a href="https://x.com" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="news-btn pulse-effect" style={{ background: '#1DA1F2', color: 'white', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 0 15px rgba(29, 161, 242, 0.4)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg> 
                TWITTER
              </button>
            </a>
            <a href="https://pump.fun/coin/4kCzTiCPBDqCE3JR7g4haoW6Lqu6Q719HuBRHvfppump" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
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
              <img src="/donald-trump-fist-pump-meme-d4k41onl2jxm1nqg.gif" alt="Gif Preview" className="preview-gif" />
              <img src="/elonsmokegif.gif" alt="Gif Preview" className="preview-gif" />
            </div>
         </div>
      </div>

      {/* Mic Permission Step — Friendly overlay before entering the game */}
      {showMicStep && (
        <div className="mic-permission-overlay">
          <div className="mic-permission-card">
            <div className="mic-permission-icon">
              {micStatus === 'granted' ? '✅' : micStatus === 'denied' ? '⚠️' : '🎙️'}
            </div>
            <h2 className="mic-permission-title">
              {micStatus === 'granted'
                ? 'Mic Enabled!'
                : micStatus === 'denied'
                ? 'Mic Blocked'
                : 'Voice Chat'}
            </h2>
            <p className="mic-permission-desc">
              {micStatus === 'granted'
                ? 'Joining the world...'
                : micStatus === 'denied'
                ? 'No worries — you can still hear others. Entering...'
                : 'Enable your microphone to talk with other players using push-to-talk (V key). You can still hear everyone without a mic.'}
            </p>
            {micStatus === 'pending' && (
              <div className="mic-permission-actions">
                <button className="mic-permission-btn mic-permission-btn--enable" onClick={handleMicEnable}>
                  🎙️ Enable Microphone
                </button>
                <button className="mic-permission-btn mic-permission-btn--skip" onClick={handleMicSkip}>
                  Skip — Just Listen
                </button>
              </div>
            )}
            {micStatus !== 'pending' && (
              <div className="mic-permission-loading">
                <span className="lobby-loading">Entering world...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
