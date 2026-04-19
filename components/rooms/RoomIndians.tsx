import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ROOM_Y_OFFSET } from '../../lib/roomsConfig'

// Indian room character — InstancedMesh version of indian_character-v1.glb,
// placed at the XZ positions + yaw (Blender Z rotation) read from
// indian_character_paths.glb.
//
// 3rd take. Previous bug cluster:
//   (a) The source mesh has 3 primitives (GLTFLoader splits into sibling
//       Meshes: character body, computer-screen plane, etc). My 2nd take
//       baked each primitive independently AND re-centered each one at
//       XZ=0/feetY=0. That centered each primitive on its OWN bbox —
//       so the body and the screen drifted apart at every instance.
//   (b) I was also using path.Y (329.4) as the instance translation Y,
//       which placed feet ~6 units above the room floor. Per the user:
//       "copia position sin altura, solo X/Z + rotación Z" — the authored
//       source node Y is the correct floor-touching height, and every
//       path placeholder represents only a horizontal copy of it.
//
// Current approach:
//   1. Bake each primitive's mesh.matrixWorld into a geometry clone so
//      the shape + orientation matches what useGLTF renders from the
//      raw file. Y of the authored transform is PRESERVED (= Blender Y
//      of ~332 where the character's feet touch the room floor).
//   2. Compute a SHARED XZ center across the UNION of all primitive
//      bboxes. Every primitive is translated by (-cx, 0, -cz) using
//      that same offset, so body + screen stay locked together.
//   3. Per-instance matrix uses path.x / path.z for translation (Y = 0
//      so baked Y is preserved) and a yaw-only quaternion from the path.
//
// Y offset: mounted inside `<group position={[0, ROOM_Y_OFFSET, 0]}>`
// so the baked Blender-world Y (~332) adds to ROOM_Y_OFFSET and lands
// at the same visual height as Room1 / RoomGirl / RoomDancer.

const CHAR_URL = '/alon_house/rooms/indian_character-v1.glb'

// Extracted offline from indian_character_paths.glb (see terminal dump in chat).
// Format: [x, y, z, qx, qy, qz, qw, scaleUniform]
// All paths share y=329.3987 and uniform scale 4.7934 (varies in last decimals;
// we snap to the first path's exact scale for consistency).
const INDIAN_PATHS: Array<[number, number, number, number, number, number, number, number]> = [
  [  35.04999542, 329.3987122, 160.34213257, 0,  0.28594846, 0, 0.95824498, 4.79341745],
  [  30.82033920, 329.3987122, 179.00668335, 0, -0.29872075, 0, 0.95434058, 4.79341698],
  [  17.89428711, 329.3987122, 200.39279175, 0,  0.18559946, 0, 0.98262548, 4.79341698],
  [  -6.76090813, 329.3987122, 200.39279175, 0, -0.36115158, 0, 0.93250722, 4.79341698],
  [ -28.32342339, 329.3987122, 196.29612732, 0,  0.22824603, 0, 0.97360349, 4.79341698],
  [ -54.65962601, 329.3987122, 194.68882751, 0, -0.12655966, 0, 0.99195898, 4.79341698],
  [ -73.54673004, 329.3987122, 201.85789490, 0,  0.20833415, 0, 0.97805768, 4.79341698],
  [ -97.68287659, 329.3987122, 202.58592224, 0,  0.63265920, 0, 0.77443045, 4.79341745],
  [-118.31443024, 329.3987122, 197.78492737, 0,  0.34139472, 0, 0.93992001, 4.79341698],
  [-128.73751831, 329.3987122, 180.60809326, 0,  0.59730816, 0, 0.80201197, 4.79341698],
  [-118.46568298, 329.3987122, 146.76454163, 0,  0.18856846, 0, 0.98206013, 4.79341745],
]

// Collect every renderable Mesh under a root. The source GLB has a single
// node `indian_room_character` with 1 `Plane.148` mesh made of 3 primitives;
// the GLTFLoader splits that into 3 sibling Mesh children. Each gets its
// own InstancedMesh so materials stay intact.
function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  root.traverse((o: any) => { if (o.isMesh) out.push(o) })
  return out
}

// Given the source meshes, produce one geometry clone per mesh whose
// vertices are baked in world space AND share a common XZ anchor (the
// union bbox center). Y is preserved so the character's feet stay at
// their authored floor-touching height. Returning parallel arrays keeps
// the multi-primitive relationship intact: primitive i is a sibling of
// primitive j and they render at the exact same instance matrix.
function bakeCombinedGeometries(meshes: THREE.Mesh[]): THREE.BufferGeometry[] {
  // Pass 1: clone + bake world matrix; compute UNION bbox on XZ.
  const clones: THREE.BufferGeometry[] = []
  const combined = new THREE.Box3().makeEmpty()
  for (const m of meshes) {
    m.updateMatrixWorld(true)
    const g = m.geometry.clone()
    g.applyMatrix4(m.matrixWorld)
    g.computeBoundingBox()
    if (g.boundingBox) combined.union(g.boundingBox)
    clones.push(g)
  }

  // Pass 2: shared XZ recenter. Y stays — the baked Y is already the
  // correct Blender-world height (feet on the room floor once the outer
  // ROOM_Y_OFFSET wrapper is applied).
  const cx = (combined.min.x + combined.max.x) / 2
  const cz = (combined.min.z + combined.max.z) / 2
  const recenter = new THREE.Matrix4().makeTranslation(-cx, 0, -cz)
  for (const g of clones) {
    g.applyMatrix4(recenter)
    g.computeBoundingBox()
    g.computeBoundingSphere()
  }
  return clones
}

export default function RoomIndians() {
  const { scene } = useGLTF(CHAR_URL) as any
  const [sources, setSources] = useState<{ geom: THREE.BufferGeometry; mat: THREE.Material }[]>([])
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])

  // Precompute instance matrices. Path provides only X + Z translation
  // (Y = 0 → baked Y from the authored source is preserved) and a
  // pure-Y quaternion for the yaw/Blender-Z rotation. Scale = 1 because
  // the source node scale is already baked into the geometry.
  const matrices = useMemo(() => {
    return INDIAN_PATHS.map(([x, _y, z, qx, qy, qz, qw]) => {
      const m = new THREE.Matrix4()
      m.compose(
        new THREE.Vector3(x, 0, z),
        new THREE.Quaternion(qx, qy, qz, qw),
        new THREE.Vector3(1, 1, 1),
      )
      return m
    })
  }, [])

  // Extract geometry + material per primitive AND bake the source node's
  // world transform. All primitives share the SAME XZ recenter offset so
  // the body + computer-screen stay anchored to each other at every
  // instance. See header comment for the full story.
  useEffect(() => {
    if (!scene) return
    scene.updateMatrixWorld(true)
    const meshes = collectMeshes(scene)
    if (meshes.length === 0) {
      console.warn('[RoomIndians] no meshes found in', CHAR_URL)
      return
    }
    const geoms = bakeCombinedGeometries(meshes)
    const baked = meshes.map((m, i) => ({
      geom: geoms[i],
      mat: m.material as THREE.Material,
    }))
    // Detach originals so we don't render the un-instanced copy too.
    meshes.forEach((m) => { if (m.parent) m.parent.remove(m) })
    setSources(baked)
  }, [scene])

  // Write instance matrices once refs + geometry are ready.
  useEffect(() => {
    if (sources.length === 0) return
    refs.current.forEach((im) => {
      if (!im) return
      matrices.forEach((m, i) => im.setMatrixAt(i, m))
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere?.()
    })
  }, [sources, matrices])

  if (sources.length === 0) return null

  return (
    <group position={[0, ROOM_Y_OFFSET, 0]}>
      {sources.map((s, i) => (
        <instancedMesh
          key={i}
          ref={(el) => { refs.current[i] = el }}
          args={[s.geom, s.mat, INDIAN_PATHS.length]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  )
}

useGLTF.preload(CHAR_URL)
