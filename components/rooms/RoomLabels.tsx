import React, { useRef } from 'react'
import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ROOM_Y_OFFSET } from '../../lib/roomsConfig'

// Floating room labels. Positions are the raw Blender translations of each
// plane node in `public/alon_house/text_rooms.glb` (extracted offline via
// node script). The parent <group> in Scene3D already applies the
// HouseScene offset (OX/OY/OZ), so here we only need to add ROOM_Y_OFFSET
// on Y — same vertical lift that rooms.glb / rooms_physics.glb receive.
//
// Each plane's NODE NAME in Blender IS the label text (by convention, same
// pattern as the old car labels in HouseScene.jsx). Rotation from the GLB
// is intentionally ignored — we use <Billboard> so text always faces the
// camera (2D style, not 3D extruded).
type LabelEntry = {
  label: string
  position: [number, number, number]
  fontSize?: number
  // When true the label is rendered as a static 3D plane (no billboard
  // follow) that only bobs up/down on a sine wave. Used for PumpFun /
  // Jewish Room / Only Staff per user request.
  staticBob?: boolean
  // Optional Y-axis rotation for staticBob entries so each sign can face
  // a different direction (e.g. PumpFun was mirrored — set rotY = Math.PI
  // to flip it). Ignored when staticBob is false.
  rotY?: number
  color?: string
  outlineColor?: string
}

// Colors:
//   PumpFun  → pump.fun green (#10b981, matches lobby PUMP.FUN button)
//   Jewish   → strong blue
//   Woof Woof→ pink
//   Only Staff → smaller + black
//   PISS... → split into two lines via `\n`
const ROOM_LABELS: LabelEntry[] = [
  // PumpFun was mirrored → rotY = Math.PI flips it to face outward.
  { label: 'PumpFun Support',  position: [ -54.58, 340.86, 130.25], color: '#10b981', outlineColor: '#065f46', staticBob: true, rotY: Math.PI },
  // Jewish Room Y raised 337.74 → 340.86 to match PumpFun's height
  // (user said it was "muy abajo"). Orientation from the original
  // billboard version was fine, so rotY defaults to 0.
  { label: 'ALON ROOM',        position: [ -83.46, 340.86,  53.37], color: '#1d4ed8', outlineColor: '#0b1e66', staticBob: true },
  { label: 'PISS ON ME\nI AM A TOILET', position: [-104.50, 338.18, 108.94], fontSize: 1.8 },
  // Only Staff — user wants static (no camera-follow). Keep the same
  // tiny bob animation as the others for a hint of life.
  { label: 'Only Staff',       position: [ -95.03, 338.18, 131.60], fontSize: 2, color: '#000000', outlineColor: '#ffffff', staticBob: true, rotY: Math.PI },
  { label: 'Woof Woof',        position: [  69.60, 357.47,  34.80], color: '#ff6ec7', outlineColor: '#8a2a5b' },
  { label: 'HELP!!',           position: [  95.07, 332.37,  40.82] },
]

function RoomLabel({ label, position, fontSize = 3, color = '#C0C0C0', outlineColor = '#606060', staticBob, rotY = 0 }: LabelEntry) {
  const [x, y, z] = position
  const baseY = y + ROOM_Y_OFFSET
  const groupRef = useRef<THREE.Group>(null)

  // Bob for staticBob entries only. Amplitude + speed mild so it reads
  // as "alive" without feeling wobbly.
  useFrame((state) => {
    if (!staticBob || !groupRef.current) return
    groupRef.current.position.y = baseY + Math.sin(state.clock.elapsedTime * 1.6) * 0.6
  })

  const textNode = (
    <Text
      fontSize={fontSize}
      color={color}
      anchorX="center"
      anchorY="middle"
      outlineWidth={fontSize * 0.05}
      outlineColor={outlineColor}
      textAlign="center"
    >
      {label}
    </Text>
  )

  if (staticBob) {
    // Static sign: authored XZ position, Y driven by sine bob, NO
    // billboard. Use DoubleSide so the text is readable from both
    // sides of the plane (player walks around the sign).
    return (
      <group ref={groupRef} position={[x, baseY, z]} rotation={[0, rotY, 0]}>
        {textNode}
      </group>
    )
  }

  return (
    <Billboard position={[x, baseY, z]} follow>
      {textNode}
    </Billboard>
  )
}

export default function RoomLabels() {
  return (
    <group>
      {ROOM_LABELS.map((l) => (
        <RoomLabel key={l.label} {...l} />
      ))}
    </group>
  )
}
