import React, { useState, useEffect, useRef } from 'react'
import { RPC } from 'playroomkit'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { checkAdminURL, getAdminProfile, setAdminStatus } from '../../lib/auth/adminAuth'
import { MAX_PLAYERS_PER_LOBBY, getLobbyIndex, generateLobbyCode, isValidLobbyCode } from '../../lib/lobbyConfig'
import { findLobby, joinLobby, leaveLobby } from '../../lib/lobbyApi'
import { useKeyboardStore } from '../../lib/useKeyboardStore'
import AdminPasswordModal from './AdminPasswordModal'
import { SKINS } from '../../lib/skins/skinsConfig'
import SkinPreviewCanvas from '../skins/SkinPreviewCanvas'

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

function getNeighborUrls(index: number) {
  const n = SKINS.length
  if (n <= 1) return []
  const prev = SKINS[(index - 1 + n) % n]
  const next = SKINS[(index + 1) % n]
  const urls = [prev.assets.modelUrl, next.assets.modelUrl]
  prev.assets.lodModelUrls?.forEach((u) => urls.push(u))
  next.assets.lodModelUrls?.forEach((u) => urls.push(u))
  return Array.from(new Set(urls))
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
  } = useMultiplayerStore()
  const [nickname, setNickname] = useState('')
  const [audioContextInitialized, setAudioContextInitialized] = useState(false)
  const [selectedColor, setSelectedColor] = useState(SKIN_COLORS[0].hex)
  const [selectedSkinIndex, setSelectedSkinIndex] = useState(() => {
    const idx = SKINS.findIndex((s) => s.id === 'alon')
    return idx >= 0 ? idx : 0
  })
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

  const skin = SKINS[selectedSkinIndex] ?? SKINS[0]
  const neighborUrls = getNeighborUrls(selectedSkinIndex)

  const onPrevSkin = () => {
    const n = SKINS.length
    if (n <= 1) return
    setSelectedSkinIndex((i) => (i - 1 + n) % n)
  }

  const onNextSkin = () => {
    const n = SKINS.length
    if (n <= 1) return
    setSelectedSkinIndex((i) => (i + 1) % n)
  }

  // Initialize audio context on first user interaction
  const initAudioOnInteraction = () => {
    if (!audioContextInitialized) {
      import('../../lib/audio/musicSystem').then(({ initializeAudioContext }) => {
        initializeAudioContext()
        setAudioContextInitialized(true)
      })
    }
  }

  // Step 1: Validate inputs, show mic modal, and START loading world immediately
  const handlePlayClick = () => {
    initAudioOnInteraction()
    if (!nickname.trim()) {
      setError('Please enter a nickname!')
      return
    }
    if (!playroomRef.current) {
      setError('Loading multiplayer... try again.')
      return
    }
    setError('')
    setShowMicStep(true)
    // Start loading world immediately (non-blocking)
    handlePlay()
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

  // Step 3: Actually connect to lobby
  const handlePlay = async () => {
    setShowMicStep(false)
    setIsConnecting(true)
    setError('')

    try {
      const pk = playroomRef.current

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
          // Check if URL has a specific lobby param (e.g. ?lobby=ALONVERSE-2)
          // This lets normal players share lobby links with friends
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
            
            // Save user data for seamless redirect
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
      }

      const me = pk.myPlayer()
      
      if (me) {
        // Set profile - use admin profile if in admin mode
        const profile = isAdminMode 
          ? getAdminProfile(nickname.trim())
          : {
              name: nickname.trim(),
              color: selectedColor,
              skinId: skin?.id ?? 'alon',
              isAdmin: false,
              colors: { primary: selectedColor },
            }
        
        me.setState('pdata', profile)
        setLocalPlayerId(me.id)

        // Store admin nickname for lobby switching
        if (isAdminMode && profile.name) {
          const cleanName = profile.name.replace('[ADMIN] ', '')
          sessionStorage.setItem('adminNickname', cleanName)
        }

        // Also sync ourselves as a remote player marker for others
        updateRemotePlayer(me.id, {
          id: me.id,
          name: profile.name,
          color: profile.color,
          skinId: profile.skinId,
          isAdmin: profile.isAdmin,
          colors: profile.colors,
        })
      } else {
      }

      // Register RPC for synchronized music playback
      RPC.register('playMusic', async (data: any, caller: any) => {
        const { playerId, skinId } = data
        
        try {
          const { playMusicForPlayer } = await import('../../lib/audio/musicSystem')
          playMusicForPlayer(playerId, skinId)
          
          // Update player state to show music indicator and store music data for new players
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

      // Music sync happens in onPlayerJoin polling (see lines 322-329)
      // YouTube sync also happens via onPlayerJoin polling (state-based, no RPC needed)

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
            // Add local track to peers that were created in receive-only mode
            await vc.addLocalTrackToExistingPeers()
            // Create offers to any remaining remote players without a peer
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
        
        
        // Track which chat timestamps we've already shown (prevents spam)
        const seenChatTimestamps = new Set<number>()

        // CRITICAL FIX: Don't create player entry until profile is ready
        // This prevents showing temporary PlayroomKit nicknames like "Holiday69"
        const initialProfile = state.getState('pdata')
        
        // Only create player if profile exists with a name
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

        // Cache dynamic imports once — avoids creating Promise microtasks every 100ms
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

          // Single merged update — avoids 2x shallow-copy + equality check per tick
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
        }, 100) // 10 FPS sync — OPTIMIZED for better performance with 10+ players

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
          // Cleanup voice peer connection
          import('../../lib/audio/voiceChatSystem').then((vc) => vc.removePeer(state.id))
        })
      })

      setConnected(true)
      setLobbyVisible(false)

      // Cleanup voice chat on unmount
      return () => {
        window.removeEventListener('keydown', handleVoiceKeyDown)
        window.removeEventListener('keyup', handleVoiceKeyUp)
        import('../../lib/audio/voiceChatSystem').then((vc) => vc.cleanupVoiceChat())
      }
    } catch (err: any) {
      setError(`Failed to connect: ${err?.message || 'Unknown error'}. Try again.`)
      setIsConnecting(false)
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
    if (autoJoinNickname && playroomRef.current && !hasInitialized.current) {
      setTimeout(() => {
        handlePlay()
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
      {/* Background image */}
      <img
        className="lobby-video-bg"
        src="/alonVersion/image.png"
        alt=""
      />
      <div className="lobby-card lobby-card--new">
        <div className="lobby-grid">
          <div className="lobby-left">
            {/* Logo / Title */}
            <div className="lobby-header lobby-header--new">
              <img src="/elonkiss.png" alt="AlonVerse" className="lobby-logo" />
              <h1 className="lobby-title">$alonverse</h1>
              <p className="lobby-title-white">alonverse</p>
            </div>

            {/* Nickname Input */}
            <div className="lobby-section">
              <label className="lobby-label">NAME</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  initAudioOnInteraction()
                  setNickname(e.target.value)
                }}
                placeholder="Enter nickname..."
                maxLength={16}
                className="lobby-input lobby-input--new"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePlayClick()
                }}
              />
            </div>

            {/* Name color */}
            <div className="lobby-section">
              <label className="lobby-label">NAME COLOR</label>
              <div className="lobby-colors lobby-colors--new">
                {SKIN_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    className={`lobby-color-btn ${selectedColor === c.hex ? 'selected' : ''}`}
                    style={{ backgroundColor: c.hex }}
                    onClick={() => setSelectedColor(c.hex)}
                    title={c.name}
                    type="button"
                  />
                ))}
              </div>
            </div>

            {/* Error */}
            {error && <p className="lobby-error">{error}</p>}

            {/* Play Button */}
            <button
              className="lobby-play-btn lobby-play-btn--new"
              onClick={handlePlayClick}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <span className="lobby-loading">Connecting{connectingLobby ? ` to ${connectingLobby}` : ''}...</span>
              ) : (
                'PLAY'
              )}
            </button>

            <p className="lobby-footer">
              Move with WASD · Space to jump · Enter to chat · V to talk
            </p>
          </div>

          <div className="lobby-right">
            <div className="lobby-avatar-stage">
              <button
                type="button"
                className="lobby-skin-arrow lobby-skin-arrow--left"
                onClick={onPrevSkin}
                aria-label="Previous skin"
              >
                ‹
              </button>
              <button
                type="button"
                className="lobby-skin-arrow lobby-skin-arrow--right"
                onClick={onNextSkin}
                aria-label="Next skin"
              >
                ›
              </button>

              <div className="lobby-avatar-canvas">
                <SkinPreviewCanvas
                  skin={skin}
                  colors={undefined}
                  neighborUrls={neighborUrls}
                  transparent
                />
              </div>

              <div className="lobby-skin-label">
                {skin?.label ?? 'Skin'}
              </div>
            </div>

            <div className="lobby-skin-hint">
              Click arrows to customize
            </div>
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
