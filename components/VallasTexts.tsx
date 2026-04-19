import React from 'react'
import { Text } from '@react-three/drei'

// Static 3D sign texts placed on top of the fence objects.
// Each entry was extracted offline from `public/alon_house/vallas_texto.glb`
// — 4 plane nodes whose NAME is the message displayed. Positions +
// rotations + scales are the raw Blender node transforms; we apply them
// verbatim via <group> so the text inherits the authored orientation of
// each plane (no camera-follow, no billboard — user wants them fully
// static "como un cartel").
//
// Same HouseScene offset (OX/OY/OZ) as the exterior objects so they line
// up with `vallas_objecto.glb`.
const OX = 190.12
const OY = 1.1857
const OZ = -88.67

type Entry = {
  label: string
  // XYZ Blender world coords (before HouseScene offset is applied by
  // the wrapper <group> below).
  position: [number, number, number]
}

// NOTE on rotation — the quaternion in `vallas_texto.glb` rotates the
// plane so its face normal points STRAIGHT UP (plane lying flat),
// causing the "acostado" bug the user reported. Instead of trying to
// interpret / correct that quaternion, we drop it entirely: signs run
// along the Z axis of the fence line, so a constant yaw that makes the
// text face +X (toward the house / street from the fence) is correct
// for every one of them. Raising the Y by +1.2 gets the text centered
// on the visible sign surface.
const YAW_FACE_HOUSE = -Math.PI / 2 // text normal points +X

const ENTRIES: Entry[] = [
  { label: 'POOR TRENCHER PRICE 800 SOL', position: [-264.35, 5.85,  41.63] },
  { label: 'EXTRACTION GOD PRICE 6000 SOL', position: [-258.40, 5.85,  71.76] },
  { label: 'RICH TRENCHER PRICE 3000 SOL', position: [-257.62, 5.85,  98.78] },
  { label: 'POOR FAG GO GET SUM BITCHES',   position: [-257.58, 5.85, 132.95] },
]

function VallaText({ label, position }: Entry) {
  return (
    <group position={position} rotation={[0, YAW_FACE_HOUSE, 0]}>
      <Text
        fontSize={0.6}
        color="#000000"
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        maxWidth={6}
        // Slight forward offset so the text doesn't z-fight with the
        // fence sign mesh behind it.
        position={[0, 0, 0.02]}
      >
        {label}
      </Text>
    </group>
  )
}

export default function VallasTexts() {
  return (
    <group position={[OX, OY, OZ]}>
      {ENTRIES.map((e) => (
        <VallaText key={e.label} {...e} />
      ))}
    </group>
  )
}
