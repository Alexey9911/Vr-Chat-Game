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
  // Raw node quaternion from the GLB (qx, qy, qz, qw). Applied verbatim
  // so the text inherits the plane's exact authored orientation.
  quaternion: [number, number, number, number]
}

// All 4 plane nodes in vallas_texto.glb share the SAME quaternion — only
// position differs. Extracted via `node scripts/inspect-glb.mjs` + a
// raw nodes dump. If the artist later re-authors a sign with a different
// rotation, update the entry's quaternion here.
const VALLA_QUAT: [number, number, number, number] = [
  -0.6896812319755554,
  -0.156012162566185,
  -0.1560121774673462,
   0.6896812319755554,
]

const ENTRIES: Entry[] = [
  { label: 'POOR TRENCHER PRICE 800 SOL',  position: [-264.35, 5.85,  41.63], quaternion: VALLA_QUAT },
  { label: 'EXTRACTION GOD PRICE 6000 SOL', position: [-258.40, 5.85,  71.76], quaternion: VALLA_QUAT },
  { label: 'RICH TRENCHER PRICE 3000 SOL',  position: [-257.62, 5.85,  98.78], quaternion: VALLA_QUAT },
  { label: 'POOR FAG GO GET SUM BITCHES',   position: [-257.58, 5.85, 132.95], quaternion: VALLA_QUAT },
]

function VallaText({ label, position, quaternion }: Entry) {
  // Blender's default plane has normal +Z. glTF axis-convert (Z-up → Y-up)
  // turns that into +Y in the node's LOCAL space. drei's <Text> draws on
  // its own local XY with normal +Z. Rotating the Text -90° around X
  // (so its +Z maps to +Y) aligns its normal with the plane's local
  // normal; then the node quaternion rotates both the (conceptual) plane
  // and the text identically into world space — preserving the exact
  // Blender orientation the artist authored.
  return (
    <group position={position} quaternion={quaternion}>
      <Text
        // Z = π flips the text 180° around the plane normal so it
        // reads right-side-up (without this it comes out patas arriba
        // because Blender's plane +Y axis is authored pointing "down"
        // relative to drei's <Text> +Y up).
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={0.6}
        color="#000000"
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        maxWidth={6}
        // Slight forward offset along the plane's local normal (+Y)
        // so the text doesn't z-fight with the fence sign mesh behind.
        position={[0, 0.02, 0]}
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
