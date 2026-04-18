import React from 'react'
import { Billboard, Text } from '@react-three/drei'
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
  { label: 'PumpFun Support',  position: [-40.81, 336.58, 117.70], color: '#10b981', outlineColor: '#065f46' },
  { label: 'Jewish Room',      position: [-77.39, 336.58,  67.68], color: '#1d4ed8', outlineColor: '#0b1e66' },
  { label: 'PISS ON ME\nI AM A TOILET', position: [-104.50, 338.18, 108.94] },
  { label: 'Only Staff',       position: [-84.69, 338.18, 131.60], fontSize: 2, color: '#000000', outlineColor: '#ffffff' },
  { label: 'Woof Woof',        position: [ 69.60, 357.47,  34.80], color: '#ff6ec7', outlineColor: '#8a2a5b' },
  { label: 'HELP!!',           position: [ 82.32, 323.52, 117.73] },
]

function RoomLabel({ label, position, fontSize = 3, color = '#C0C0C0', outlineColor = '#606060' }: LabelEntry) {
  const [x, y, z] = position
  return (
    <Billboard position={[x, y + ROOM_Y_OFFSET, z]} follow>
      <Text
        fontSize={fontSize}
        color={color}
        anchorX="center"
        anchorY="middle".
        outlineWidth={fontSize * 0.05}
        outlineColor={outlineColor}
        textAlign="center"
      >
        {label}
      </Text>
    </Billboard>
  )
}

export default function RoomLabels() {
  return (
    <group>
      {ROOM_LABELS.map((l) => (
        <RoomLabel key={l.label} label={l.label} position={l.position} fontSize={l.fontSize} />
      ))}
    </group>
  )
}
