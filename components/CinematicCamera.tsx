import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import { useViewStore } from '../lib/camera/viewStore'
import { useKeyboardStore } from '../lib/useKeyboardStore'
import { useMultiplayerStore } from '../lib/multiplayerStore'

const FLY_SPEED = 12
const SPRINT_MULT = 2.5

export default function CinematicCamera() {
  const cinematicMode = useViewStore((s) => s.cinematicMode)
  const { camera } = useThree()
  const isKeyPressed = useKeyboardStore((s) => s.isKeyPressed)
  const chatActive = useKeyboardStore((s) => s.chatActive)
  const lobbyVisible = useMultiplayerStore((s) => s.lobbyVisible)

  const controlsRef = useRef<any>(null)
  const flyDir = useRef(new Vector3())
  const needsInit = useRef(false)

  useEffect(() => {
    if (cinematicMode) {
      needsInit.current = true
      console.log('[Cinematic] Free camera ON — WASD fly, mouse orbit, Shift sprint, F9 to exit')
    } else {
      console.log('[Cinematic] Free camera OFF')
    }
  }, [cinematicMode])

  useFrame((_, delta) => {
    if (!cinematicMode) return

    // Set initial orbit target 5 units in front of camera
    if (needsInit.current && controlsRef.current) {
      const t = camera.position.clone().add(
        new Vector3(0, 0, -5).applyQuaternion(camera.quaternion)
      )
      controlsRef.current.target.copy(t)
      controlsRef.current.update()
      needsInit.current = false
    }

    if (chatActive || lobbyVisible) return

    const speed = FLY_SPEED * delta * (isKeyPressed('shift') ? SPRINT_MULT : 1)
    const fwd = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const up = new Vector3(0, 1, 0)

    flyDir.current.set(0, 0, 0)
    // Disable W/S to avoid zoom effect - only use A/D/E/Q for movement
    // if (isKeyPressed('w')) flyDir.current.add(right)
    // if (isKeyPressed('s')) flyDir.current.sub(right)
    if (isKeyPressed('d')) flyDir.current.add(fwd)
    if (isKeyPressed('a')) flyDir.current.sub(fwd)
    if (isKeyPressed('e')) flyDir.current.add(up)
    if (isKeyPressed('q')) flyDir.current.sub(up)

    if (flyDir.current.lengthSq() > 0.001) {
      flyDir.current.normalize().multiplyScalar(speed)
      camera.position.add(flyDir.current)
      if (controlsRef.current) {
        controlsRef.current.target.add(flyDir.current)
      }
    }
  })

  if (!cinematicMode) return null

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.8}
      zoomSpeed={1.2}
      enablePan
      panSpeed={1.5}
      minDistance={0.5}
      maxDistance={500}
      makeDefault
    />
  )
}
