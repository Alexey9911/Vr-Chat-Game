import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useZoneStore } from '../../lib/zoneStore'
import { teleportPlayer } from '../../lib/teleportController'
import { EYE_HEIGHT } from '../../lib/camera/cameraConstants'
import { localPlayerLive } from '../../lib/localPlayerRef'

// Exterior spawn point (same as player spawn)
const EXTERIOR_POS = new THREE.Vector3(-59.95, EYE_HEIGHT, -87.86)
const EXTERIOR_ROT = (74.61 + 180) * (Math.PI / 180) // Same as SPAWN_ROT

// Exit checkpoint position — will be placed inside room1 near door
// TBD: User will provide exact position later
const EXIT_CHECKPOINT_POS = new THREE.Vector3(-141.60, 321, 87.89) // near room1 floor edge

const TRIGGER_DISTANCE = 6

export default function CheckpointExitHouse() {
  const cooldownRef = useRef(0)
  const timeRef = useRef(0)
  const meshRef = useRef<THREE.Group>(null)
  const currentZone = useZoneStore((s) => s.currentZone)

  useFrame((_, delta) => {
    // Bob animation
    if (meshRef.current) {
      timeRef.current += delta
      meshRef.current.position.y = EXIT_CHECKPOINT_POS.y + Math.sin(timeRef.current * 2) * 0.8
    }

    if (cooldownRef.current > 0) {
      cooldownRef.current -= delta
      return
    }

    const { currentZone: zone, isTransitioning, setZone, setTransitioning } = useZoneStore.getState()
    if (isTransitioning || zone !== 'interior') return
    if (!localPlayerLive.ready) return

    const dx = localPlayerLive.x - EXIT_CHECKPOINT_POS.x
    const dz = localPlayerLive.z - EXIT_CHECKPOINT_POS.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < TRIGGER_DISTANCE) {
      console.log('[Checkpoint Exit] TRIGGERED! Distance:', dist.toFixed(2))
      setTransitioning(true)
      cooldownRef.current = 3

      setTimeout(() => {
        teleportPlayer(EXTERIOR_POS, EXTERIOR_ROT)
        setZone('exterior')
        setTimeout(() => setTransitioning(false), 600)
      }, 500)
    }
  })

  // Only render when in interior
  if (currentZone !== 'interior') return null

  return (
    <group ref={meshRef} position={[EXIT_CHECKPOINT_POS.x, EXIT_CHECKPOINT_POS.y, EXIT_CHECKPOINT_POS.z]}>
      {/* Simple yellow triangle marker for exit */}
      <mesh rotation-x={Math.PI}>
        <coneGeometry args={[1.5, 4, 3]} />
        <meshBasicMaterial color="#ffdd00" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
