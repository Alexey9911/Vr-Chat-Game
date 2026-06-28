import { useEffect, useState } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import KeyboardHUD from '../components/KeyboardHUD'
import TouchControls from '../components/TouchControls'
import { useIsMobile } from '../hooks/useIsMobile'
import CASection from '../components/CASection'
import EntryLoadingOverlay from '../components/EntryLoadingOverlay'
import AssetPreloader from '../components/AssetPreloader'
import { useMultiplayerStore } from '../lib/multiplayerStore'
import { setLocalState as netSetLocalState, setMediaStartEpoch as netSetMediaStartEpoch } from '../lib/net/netClient'
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

// Multiplayer components — dynamic to avoid SSR (client-only)
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

  const handlePlayMusic = () => {
    // play locally + broadcast persistent state (isMusicPlaying + mediaStartEpoch) so LATE JOINERS
    // hear it via the reconciler — no fire-and-forget RPC that newcomers miss.
    const { localPlayerId, remotePlayers } = useMultiplayerStore.getState()
    if (!localPlayerId) return
    const skinId = remotePlayers.get(localPlayerId)?.skinId || 'ansem'
    import('../lib/audio/musicSystem').then(({ playMusicForPlayer }) => playMusicForPlayer(localPlayerId, skinId))
    netSetMediaStartEpoch(Date.now())
    netSetLocalState({ isMusicPlaying: true, isYouTubePlaying: false, youtubeVideoId: undefined })
  }

  const handleStopMusic = () => {
    const { localPlayerId } = useMultiplayerStore.getState()
    if (!localPlayerId) return
    import('../lib/audio/musicSystem').then(({ stopMusicForPlayer }) => stopMusicForPlayer(localPlayerId))
    netSetMediaStartEpoch(undefined)
    netSetLocalState({ isMusicPlaying: false })
  }

  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <>
      <Head>
        <title>$alonverse · 3D World</title>
        <meta name="description" content="$alonverse · 3D Social World" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preload" href="/sky.hdr" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/elonkiss.png" as="image" />
      </Head>

      <main>
        {isClient && (
          <>
            {/* Kick off every critical GLB download in parallel with the
                Canvas3D mount. Registering preloads with drei's loader
                means their bytes count toward useProgress → the threshold
                in EntryLoadingOverlay now genuinely waits for them.
                Unmounts once the lobby is ready (all caches warm). */}
            {!readyForLobby && <AssetPreloader />}

            {!readyForLobby && (
              <EntryLoadingOverlay
                // 95% instead of the old 70% — lobby only appears when the
                // heavy GLBs (rooms, skins, balcony, checkpoints) are fully
                // downloaded. Previously dismissing at 70% caused the
                // nickname input to jank while the remaining assets
                // streamed in mid-typing.
                threshold={90}
                minDurationMs={1500}
                onReady={() => setReadyForLobby(true)}
              />
            )}

            {/* Only show UI elements after loading is complete */}
            {readyForLobby && (
              <>
                <Navbar />
                <CASection />
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
