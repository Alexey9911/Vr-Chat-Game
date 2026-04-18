import React, { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, PerspectiveCamera, useProgress } from '@react-three/drei'
import Scene3D from './Scene3D'
import CinematicCamera from './CinematicCamera'
import CameraDebugHUD from './CameraDebugHUD'
import DebugCameraFar from './DebugCameraFar'
import FullLoadingScreen from './LoadingScreen/LoadingScreen'
import { useCameraControls } from '../hooks/useCameraControls'
import { EYE_HEIGHT } from '../lib/camera/cameraConstants'
import { useSettingsStore } from '../lib/settings/settingsStore'

// Threshold (percent) at which we consider the heavy scene "ready enough" to dismiss
// the loading screen. Skins + rest trickle in while the user interacts with the lobby.
const LOADING_READY_THRESHOLD = 65

// Camera controller component
const CameraController: React.FC = () => {
  useCameraControls()
  return null
}

// Main canvas component with integrated loading logic
const Canvas3D: React.FC<{ loadingOverlayEnabled?: boolean; forceHidden?: boolean }> = ({ loadingOverlayEnabled = true, forceHidden = false }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const environment = useSettingsStore((s) => s.environment)
  // Usar useProgress para trackear la carga global de R3F
  const { progress } = useProgress()
  const [dismissed, setDismissed] = React.useState(false)
  const isSceneLoaded = progress >= LOADING_READY_THRESHOLD

  const isLoading = loadingOverlayEnabled && !dismissed

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Loading screen overlay (Nolvi-style with phases + gates) */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1000,
        }}>
          <FullLoadingScreen
            sceneProgress={progress}
            isSceneLoaded={isSceneLoaded}
            onComplete={() => setDismissed(true)}
            onIntroStart={() => { /* reserved for future GPU warmup trigger */ }}
          />
        </div>
      )}
      {/* Canvas container oculta por loading */}
      <div 
        ref={containerRef} 
        className="canvas-container"
        style={{ 
          opacity: isLoading || forceHidden ? 0 : 1,
          pointerEvents: forceHidden ? 'none' : 'auto',
          transition: 'opacity 0.15s ease-in-out'
        }}
      >
        <Canvas
          shadows={false}
          dpr={1}
          gl={{
            antialias: true,
            alpha: false,
            stencil: false,
            powerPreference: "high-performance"
          }}
          camera={{
            fov: 75,
            near: 0.1,
            far: 1000,
            position: [-59.95, EYE_HEIGHT, -87.86]
          }}
        >
          {/* hdri sky — switches based on settings */}
          {environment === 'sunset' && (
            <Environment files={"sky.hdr"} background environmentIntensity={1.4} />
          )}
          {environment === 'night' && (
            <Environment preset="night" background environmentIntensity={0.6} />
          )}
          {environment === 'warehouse' && (
            <Environment preset="warehouse" background environmentIntensity={1.2} />
          )}
          
          {/* Camera Controls */}
          <CameraController />
          <CinematicCamera />
          <CameraDebugHUD />
          {/* Leva debug panel (camera near/far tuning) — temporarily disabled */}
          {/* <DebugCameraFar /> */}
         
          {/* Perspective Camera Setup */}
          <PerspectiveCamera
            makeDefault
            fov={75}
            position={[-59.95, EYE_HEIGHT, -87.86]}
          />
         
          {/* Scene with Suspense boundary */}
          <Suspense
            fallback={
              <mesh position={[0, 1.5, -6]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#00ff88" />
              </mesh>
            }
          >
            <Scene3D containerRef={containerRef} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}

export default Canvas3D
