import { useRef, useEffect, useState } from 'react'
import { useGLTF, Text, Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Height of the floating "Orangie" label above the NPC (local units, pre-scale)
const LABEL_Y_OFFSET = 16

// NPC (Mesh_0.001, wheelchair guy) extracted from house_scene-v1.glb and animated
// along 4 waypoints that form a square around the house.
//
// Waypoints read from orangie_paths.glb (Blender coords, Y ignored — keep NPC at its own Y):
//   path 2 → (-242.69,  _, 183.64)
//   path 3 → ( -88.24,  _, 183.64)
//   path 4 → ( -88.24,  _,   3.62)
//   path 5 → (-242.56,  _,   3.62)
// NPC base position in GLB: (-242.55, 0.87, 3.25) ≈ near path 5, so we start heading toward path 2.

const NPC_Y = 0.87 // NPC's own ground Y from its GLB node (we ignore path plane heights per user)
const SPEED = 50  // units per second (halved per user request — was 100)
const ARRIVE_EPS = 1.0

// The waypoint traversal order (cycles)
const WAYPOINTS = [
  new THREE.Vector3(-242.69, NPC_Y, 183.64), // path 2
  new THREE.Vector3( -88.24, NPC_Y, 183.64), // path 3
  new THREE.Vector3( -88.24, NPC_Y,   3.62), // path 4
  new THREE.Vector3(-242.56, NPC_Y,   3.62), // path 5  (and back to path 2)
]

// Starting position (NPC's GLB base — already close to path 5)
const START_POS = new THREE.Vector3(-242.55, NPC_Y, 3.25)

// Offset so "facing forward" in the source mesh matches the initial path direction.
// If NPC looks sideways while moving, adjust this (e.g., ±Math.PI/2, Math.PI).
const YAW_OFFSET = 0

export default function OrangiePathNPC() {
  const { scene } = useGLTF('/alon_house/house_scene-v1.glb')
  const groupRef = useRef()
  const [npcMesh, setNpcMesh] = useState(null)
  const state = useRef({ targetIdx: 0, pos: START_POS.clone() })

  // Detach Mesh_0.001 from the house scene graph and prepare it for external control.
  // This avoids .clone() visibility-inheritance issues and guarantees a single instance.
  useEffect(() => {
    if (!scene) return
    // GLTF loader sanitizes dots in node names (Mesh_0.001 → Mesh_0001 etc).
    // Search by known variants, then regex fallback.
    const candidates = ['Mesh_0.001', 'Mesh_0_001', 'Mesh_0001']
    let src = null
    for (const name of candidates) {
      src = scene.getObjectByName(name)
      if (src) break
    }
    if (!src) {
      scene.traverse((o) => {
        if (!src && o.isMesh && /^Mesh_0[._]?001$/i.test(o.name)) src = o
      })
    }
    if (!src) return
    // Remove from original parent; keep world-state then strip local transform
    // (we control the transform via the parent <group ref={groupRef}>).
    if (src.parent) src.parent.remove(src)
    src.position.set(0, 0, 0)
    src.quaternion.identity()
    src.visible = true
    src.traverse((child) => {
      child.visible = true
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    setNpcMesh(src)
  }, [scene])

  // Seed group transform once mesh is ready so it renders at START_POS for frame 1.
  useEffect(() => {
    if (!groupRef.current || !npcMesh) return
    groupRef.current.position.copy(state.current.pos)
  }, [npcMesh])

  useFrame((_, delta) => {
    if (!groupRef.current || !npcMesh) return

    const target = WAYPOINTS[state.current.targetIdx]
    const pos = state.current.pos

    const dx = target.x - pos.x
    const dz = target.z - pos.z
    const dist = Math.hypot(dx, dz)

    if (dist < ARRIVE_EPS) {
      state.current.targetIdx = (state.current.targetIdx + 1) % WAYPOINTS.length
      return
    }

    const step = Math.min(SPEED * delta, dist)
    const invDist = 1 / dist
    pos.x += dx * invDist * step
    pos.z += dz * invDist * step
    pos.y = NPC_Y

    groupRef.current.position.copy(pos)
    groupRef.current.rotation.y = Math.atan2(dx, dz) + YAW_OFFSET
  })

  if (!npcMesh) return null
  return (
    <group ref={groupRef}>
      <primitive object={npcMesh} />
      {/* Floating "Orangie" label — follows NPC position, faces camera */}
      <Billboard position={[0, LABEL_Y_OFFSET, 0]} follow>
        <Text
          fontSize={2.5}
          color='#FF8C1A'
          anchorX='center'
          anchorY='middle'
          font='/font1.ttf'
          outlineWidth={0.12}
          outlineColor='#7A2F00'
        >
          Orangie
          <meshStandardMaterial
            color='#FF8C1A'
            emissive='#FF5500'
            emissiveIntensity={0.7}
            metalness={0.4}
            roughness={0.3}
            toneMapped={false}
          />
        </Text>
      </Billboard>
    </group>
  )
}
