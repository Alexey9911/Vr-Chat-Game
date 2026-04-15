import React, { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, PerspectiveCamera, useProgress } from '@react-three/drei'
import Scene3D from './Scene3D'
import CinematicCamera from './CinematicCamera'
import { useCameraControls } from '../hooks/useCameraControls'
import { EYE_HEIGHT } from '../lib/camera/cameraConstants'
import { useSettingsStore } from '../lib/settings/settingsStore'

// Camera controller component
const CameraController: React.FC = () => {
  useCameraControls()
  return null
}

// Enhanced loading screen component
const LoadingScreen: React.FC = () => {
  const { progress } = useProgress()

  return (
    <div className="loading">
      <img
        src="/elonkiss.png"
        alt="ElonKiss"
        style={simplePulseImgStyle}
      />
      <div style={loadingTextStyle}>
        loading
        <div style={{ 
          fontSize: '18px', 
          opacity: 0.8, 
          marginTop: '12px', 
          letterSpacing: '1px',
          fontWeight: 400 
        }}>
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  )
}

// ==== Styles ====

// Ya no usamos loaderOverlay ni loaderContent, se usan estilos .loading desde el CSS global para mantener el gradient original

const simplePulseImgStyle: React.CSSProperties = {
  width: '224px',
  height: '224px',
  objectFit: 'contain',
  marginBottom: 24,
  animation: 'simpleFade 1.5s infinite ease-in-out',
}

const loadingTextStyle: React.CSSProperties = {
  color: '#fff',
  fontWeight: 500,
  fontSize: 32,
  letterSpacing: 2,
  textAlign: 'center',
  fontFamily: 'inherit',
}

// CSS keyframes for pulse effect
if (typeof window !== 'undefined') {
  const simplePulseAnim = `@keyframes simpleFade { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }`;
  if (!document.getElementById('simple-pulse-style')) {
    const style = document.createElement('style')
    style.id = 'simple-pulse-style'
    style.appendChild(document.createTextNode(simplePulseAnim))
    document.head.appendChild(style)
  }
}

// Main canvas component with integrated loading logic
const Canvas3D: React.FC<{ loadingOverlayEnabled?: boolean; forceHidden?: boolean }> = ({ loadingOverlayEnabled = true, forceHidden = false }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const environment = useSettingsStore((s) => s.environment)
  // Usar useProgress para trackear la carga global de R3F
  const { progress, active } = useProgress()
  const [dismissed, setDismissed] = React.useState(false)
  React.useEffect(() => {
    if (progress >= 100) setDismissed(true)
  }, [progress])

  const isLoading = loadingOverlayEnabled && !dismissed && (active || progress < 100)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Loading screen overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1000,
          backgroundColor: 'inherit'
        }}>
          <LoadingScreen />
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
            position: [0, EYE_HEIGHT, 5]
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
         
          {/* Perspective Camera Setup */}
          <PerspectiveCamera
            makeDefault
            fov={75}
            position={[0, EYE_HEIGHT, 5]}
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
