import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { RPC } from 'playroomkit'
import KeyboardHUD from '../components/KeyboardHUD'
import TouchControls from '../components/TouchControls'
import { useIsMobile } from '../hooks/useIsMobile'
import CASection from '../components/CASection'
import CoordsDebug from '../components/CoordsDebug'
import EntryLoadingOverlay from '../components/EntryLoadingOverlay'
import { useMultiplayerStore } from '../lib/multiplayerStore'
import Navbar from '../components/Navbar'
import CinematicHUD from '../components/CinematicHUD'
import FadeOverlay from '../components/checkpoints/FadeOverlay'
import { useZoneStore } from '../lib/zoneStore'

// Dynamically import Canvas3D to avoid SSR issues
const Canvas3D = dynamic(() => import('../components/Canvas3D'), {
  ssr: false,
  loading: () => (
    <div className="loading">
      {/* Loading 3D Environment... */}
    </div>
  )
})

// Multiplayer components — dynamic to avoid SSR (PlayroomKit is client-only)
const LobbyScreen = dynamic(() => import('../components/multiplayer/LobbyScreen'), { ssr: false })
const ChatInput = dynamic(() => import('../components/multiplayer/ChatInput'), { ssr: false })
const PlayersList = dynamic(() => import('../components/multiplayer/PlayersList'), { ssr: false })
const SkinsModal = dynamic(() => import('../components/skins/SkinsModal'), { ssr: false })
const AdminFloatButton = dynamic(() => import('../components/multiplayer/AdminFloatButton'), { ssr: false })
const AdminLobbyPanel = dynamic(() => import('../components/multiplayer/AdminLobbyPanel'), { ssr: false })
const AudioButton = dynamic(() => import('../components/ui/AudioButton'), { ssr: false })
const SkinBar = dynamic(() => import('../components/ui/SkinBar'), { ssr: false })
const EmoteBar = dynamic(() => import('../components/ui/EmoteBar'), { ssr: false })
const SettingsModal = dynamic(() => import('../components/settings/SettingsModal'), { ssr: false })
const PositionDebug = dynamic(() => import('../components/PositionDebug'), { ssr: false })

function HomePage() {
  const [isClient, setIsClient] = useState(false)
  const [readyForLobby, setReadyForLobby] = useState(false)
  const isMobile = useIsMobile()
  const lobbyVisible = useMultiplayerStore((s) => s.lobbyVisible)
  const isTransitioning = useZoneStore((s) => s.isTransitioning)
  const playroomRef = React.useRef<any>(null)

  useEffect(() => {
    // @ts-ignore
    import('playroomkit').then((mod: any) => {
      playroomRef.current = mod
    })
  }, [])

  const handlePlayMusic = () => {
    if (!playroomRef.current) return

    const pk = playroomRef.current
    const player = pk.myPlayer()
    if (!player) return

    const profile = player.getState('pdata')
    const playerId = player.id
    const skinId = profile?.skinId || 'alon'

    try {
      RPC.call('playMusic', { playerId, skinId }, RPC.Mode.ALL)
    } catch (err) {
      console.error('[Music] Failed to call RPC:', err)
    }
  }

  const handleStopMusic = () => {
    if (!playroomRef.current) return
    const pk = playroomRef.current
    const player = pk.myPlayer()
    if (!player) return
    try {
      RPC.call('stopMusic', { playerId: player.id }, RPC.Mode.ALL)
    } catch (err) {
      console.error('[Music] Failed to call stopMusic RPC:', err)
    }
  }

  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <>
      <Head>
        <title>3D World</title>
        <meta name="description" content="3D World" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preload" href="/sky.hdr" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/elonkiss.png" as="image" />
      </Head>

      <main>
        {isClient && (
          <>
            {!readyForLobby && (
              <EntryLoadingOverlay
                threshold={70}
                minDurationMs={1500}
                onReady={() => setReadyForLobby(true)}
              />
            )}

            {/* Only show UI elements after loading is complete */}
            {readyForLobby && (
              <>
                <Navbar />
                <CASection />
                <CoordsDebug />
                {isMobile ? <TouchControls /> : <KeyboardHUD />}
                <CinematicHUD />
                {/* Debug overlays — temporarily disabled (uncomment when tuning positions / camera frustum) */}
                {/* <PositionDebug /> */}
              </>
            )}

            {/* 3D Canvas (hidden while loading and while lobby is visible) */}
            <Canvas3D loadingOverlayEnabled={false} forceHidden={!readyForLobby || lobbyVisible} />

            {/* Lobby — shown only when the scene is sufficiently loaded */}
            {readyForLobby && <LobbyScreen />}

            {/* Multiplayer UI overlays - only show after loading */}
            {readyForLobby && (
              <>
                <PlayersList />
                <ChatInput />
                <SkinsModal />
                <SettingsModal />
                <AdminFloatButton />
                <AdminLobbyPanel />
                <AudioButton onPlayMusic={handlePlayMusic} onStopMusic={handleStopMusic} />
                <SkinBar />
                <EmoteBar />
              </>
            )}
          </>
        )}
        
        {/* Zone transition fade overlay (GTA SA style) */}
        <FadeOverlay isActive={isTransitioning} />

        {!isClient && (
          <div className="loading">
            {/* Initializing 3D Explorer... */}
          </div>
        )}
      </main>
    </>
  )
}

export default HomePage
