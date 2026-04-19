import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useZoneStore } from '../../lib/zoneStore'
import { teleportPlayer } from '../../lib/teleportController'
import { localPlayerLive } from '../../lib/localPlayerRef'
const OX = 190.12, OY = 1.1857, OZ = -88.67

// Checkpoint #4 — lives on the exterior balcony. Walking into it sends
// the player BACK into the rooms, next to checkpoint #3. The player can
// also just jump off the balcony and bypass this entirely — they'll
// land on the exterior ground near checkpoint #1 (house entry), which is
// fine by design.
const CP4_BLENDER: [number, number, number] = [-188.28, 45.45, 98.57]
const CP4_WORLD = {
  x: CP4_BLENDER[0] + OX,
  y: CP4_BLENDER[1] + OY,
  z: CP4_BLENDER[2] + OZ,
}

// Destination: user-provided WORLD coords where the player should appear
// in the rooms when coming back through the balcony door. Already include
// ROOM_Y_OFFSET (Y ≈ 504 = rooms-level) and the HouseScene offset.
// Sourced from in-game coords HUD at the desired spot:
//   X: 148.67, Y: 504.73, Z: 8.18, rot 266°.
// Far from CP3 (~20 units in X) so zone gating + cooldown prevent the
// immediate bounce-back bug we had when the destination overlapped CP3.
const ROOMS_SPAWN = new THREE.Vector3(148.67, 504.73, 8.18)
// Flipped 180° from the original 266° → 86°. Previous value had the
// player looking INTO the house; user said "apunta a la otra dirección".
// They'll pass the exact final angle later — at that point replace 86°.
const ROOMS_ROT = (86 * Math.PI) / 180 // yaw in radians

const TRIGGER_DISTANCE = 6

function findByName(root: THREE.Object3D, ...candidates: string[]): THREE.Object3D | null {
  for (const n of candidates) {
    const o = root.getObjectByName(n)
    if (o) return o
  }
  return null
}

export default function CheckpointBalconyToRooms() {
  const gltf = useGLTF('/alon_house/checkpoints_all.glb')
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)
  const cooldownRef = useRef(0)

  const meshNode = useMemo(() => {
    const node = findByName(gltf.scene, 'checkpoint_door_house_entry_4')
    if (!node) return null
    const clone = (node as any).clone(true) as THREE.Object3D
    clone.traverse((child: any) => {
      if (!child.isMesh) return
      child.material = new THREE.MeshBasicMaterial({
        color: '#ffdd00',
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      child.renderOrder = 999
      child.frustumCulled = false
    })
    return clone
  }, [gltf.scene])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    timeRef.current += delta
    groupRef.current.position.y = Math.sin(timeRef.current * 2) * 0.8

    if (cooldownRef.current > 0) {
      cooldownRef.current -= delta
      return
    }

    const { currentZone, isTransitioning, setZone, setTransitioning } = useZoneStore.getState()
    // Only active while the player is on the balcony.
    if (isTransitioning || currentZone !== 'balcon') return
    if (!localPlayerLive.ready) return

    // XZ-only distance — see CheckpointRoomsToBalcony for rationale.
    const dx = localPlayerLive.x - CP4_WORLD.x
    const dz = localPlayerLive.z - CP4_WORLD.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < TRIGGER_DISTANCE) {
      // console.info('[Checkpoint 4 → interior] triggered dist=', dist.toFixed(2))
      setTransitioning(true)
      cooldownRef.current = 3
      setTimeout(() => {
        teleportPlayer(ROOMS_SPAWN, ROOMS_ROT)
        setZone('interior')
        setTimeout(() => setTransitioning(false), 600)
      }, 500)
    }
  })

  if (!meshNode) return null
  return (
    <group ref={groupRef}>
      <primitive object={meshNode} />
    </group>
  )
}

useGLTF.preload('/alon_house/checkpoints_all.glb')
