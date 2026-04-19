import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useZoneStore } from '../../lib/zoneStore'
import { teleportPlayer } from '../../lib/teleportController'
import { EYE_HEIGHT } from '../../lib/camera/cameraConstants'
import { localPlayerLive } from '../../lib/localPlayerRef'
import { ROOM_Y_OFFSET } from '../../lib/roomsConfig'

// Same HouseScene offset as every other world-coord component.
const OX = 190.12, OY = 1.1857, OZ = -88.67

// Checkpoint #3 — lives in the rooms interior. Walking into it teleports
// the player OUT onto the exterior balcony (checkpoint #4 position).
// Node `checkpoint_door_house_entry_3` inside checkpoints_all.glb
// (Blender coords, Y ≈ 335 — rooms-level, gets ROOM_Y_OFFSET at render).
const CP3_BLENDER: [number, number, number] = [-21.04, 335.36, 97.42]
// Trigger check uses the FINAL world position (Blender + offsets + lift).
const CP3_WORLD = {
  x: CP3_BLENDER[0] + OX,
  y: CP3_BLENDER[1] + OY + ROOM_Y_OFFSET,
  z: CP3_BLENDER[2] + OZ,
}

// Destination: on the balcony, FAR ENOUGH from checkpoint #4 that the
// return checkpoint's XZ trigger radius (TRIGGER_DISTANCE = 6) does not
// engulf the landing spot. Previous +3 offset caused an immediate
// bounce-back: player lands → zone flips to 'balcon' → CP4's gate opens
// → CP4 detects proximity → teleports back to rooms instantly.
// 15-unit offset along +X puts the player ~15 > 2×TRIGGER_DISTANCE from
// CP4, giving the cooldown + zone-change grace plenty of room to expire
// before the player can re-enter CP4.
// User will likely provide explicit landing coords later — at that point
// replace these numbers with the Vector3 they give you (same pattern as
// ROOMS_SPAWN in CheckpointBalconyToRooms).
// World-coord landing (sourced from in-game COORDS HUD at desired spot,
// shifted -15 on X per user request to push player further back on the
// balcony, away from CP4 so the cooldown/zone-change grace can expire).
const BALCONY_SPAWN = new THREE.Vector3(-17, 38.67, 12.91)
// Face so the player spawns looking in the direction the user wants
// on the balcony. The HUD reads `playerFacingY` which equals
// `rotY + π` (mod 2π), so to show 275° we set rotY = 275° − 180° = 95°.
const BALCONY_ROT = (95 * Math.PI) / 180 // displayed facing = 275°

const TRIGGER_DISTANCE = 6

// Find a mesh by exact or sanitized name (GLTFLoader sometimes swaps '.'→'_').
function findByName(root: THREE.Object3D, ...candidates: string[]): THREE.Object3D | null {
  for (const n of candidates) {
    const o = root.getObjectByName(n)
    if (o) return o
  }
  return null
}

export default function CheckpointRoomsToBalcony() {
  const gltf = useGLTF('/alon_house/checkpoints_all.glb')
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)
  const cooldownRef = useRef(0)

  // Extract just checkpoint #3's mesh from the combined GLB and apply
  // the same yellow-gradient look the house-entry checkpoint uses.
  const meshNode = useMemo(() => {
    const node = findByName(gltf.scene, 'checkpoint_door_house_entry_3')
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
    // The node's own translation (Blender coords) is preserved so placing
    // the group inside the rooms wrapper yields the correct world pos.
    return clone
  }, [gltf.scene])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Bob up/down
    timeRef.current += delta
    groupRef.current.position.y = Math.sin(timeRef.current * 2) * 0.8

    if (cooldownRef.current > 0) {
      cooldownRef.current -= delta
      return
    }

    const { currentZone, isTransitioning, setZone, setTransitioning } = useZoneStore.getState()
    // Only active while the player is inside the rooms.
    if (isTransitioning || currentZone !== 'interior') return
    if (!localPlayerLive.ready) return

    // XZ-only distance: the room floor is large on Y (player eye Y ≈
    // ROOM_FLOOR_BLENDER_Y + EYE_HEIGHT + ROOM_Y_OFFSET ≈ 504) but the
    // checkpoint mesh pivots a few units off the exact player Y depending
    // on bob animation + how the Blender artist anchored the mesh. Using
    // a 3D distance would require pixel-perfect Y matching (previous bug
    // where CP3 would never trigger because Y was off by ~8). Matches
    // the pattern used by CheckpointEntryHouse / CheckpointExitHouse.
    const dx = localPlayerLive.x - CP3_WORLD.x
    const dz = localPlayerLive.z - CP3_WORLD.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < TRIGGER_DISTANCE) {
      // console.info('[Checkpoint 3 → balcon] triggered dist=', dist.toFixed(2))
      setTransitioning(true)
      cooldownRef.current = 3
      setTimeout(() => {
        teleportPlayer(BALCONY_SPAWN, BALCONY_ROT)
        setZone('balcon')
        setTimeout(() => setTransitioning(false), 600)
      }, 500)
    }
  })

  if (!meshNode) return null
  // Outer group carries the rooms vertical lift so the checkpoint visual
  // aligns with the rooms floor. Inner bob-group keeps only the sinusoidal
  // Y wobble (position.y written every frame), so the lift is preserved.
  return (
    <group position={[0, ROOM_Y_OFFSET, 0]}>
      <group ref={groupRef}>
        <primitive object={meshNode} />
      </group>
    </group>
  )
}

useGLTF.preload('/alon_house/checkpoints_all.glb')
