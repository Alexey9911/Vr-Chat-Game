import { useEffect, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// Airdrops — InstancedMesh versions of Mesh_0.002 and Mesh_0.003 from house_scene-v1.glb.
// One InstancedMesh per type → one draw call per type regardless of instance count.
//
// Plane positions + rotations read from airdrop_paths.glb (terminal inspection, no runtime load).
// Height of each plane is ignored per user: we keep the Y from the SOURCE mesh so every
// instance sits at the same ground level regardless of where the guide plane was in Blender.
//
// AIRDROP_1  → Mesh_0.003 (source Y = 8.19, scale = 8.19)
// AIRDROP_2  → Mesh_0.002 (source Y = 0.30, scale = 7.67)

// Each entry: [x, z, quaternion[x,y,z,w]]
const AIRDROP_1_PLANES = [
  [-325.08, -16.57, [ 0.5904848,  -0.3890086,   0.3890086,   0.5904849]],
  [-327.99,  14.96, [ 0.1330249,  -0.6944814,   0.6944814,   0.1330249]],
  [-346.29,  17.27, [ 0.0124777,   0.7069967,  -0.7069967,   0.0124777]],
]
const AIRDROP_2_PLANES = [
  [-329.23, -27.34, [ 0.6550099,  -0.2663870,   0.2663871,   0.6550099]],
  [-337.09,  16.58, [ 0.0233904,  -0.7067198,   0.7067198,   0.0233904]],
  [-356.94,  16.52, [ 0.1172454,   0.6973188,  -0.6973188,   0.1172454]],
]

const SOURCE_Y_1 = 8.19       // Mesh_0.003 ground Y
const SOURCE_Y_2 = 0.30       // Mesh_0.002 ground Y
const SOURCE_SCALE_1 = 8.1916 // Mesh_0.003 uniform scale from GLB
const SOURCE_SCALE_2 = 7.6679 // Mesh_0.002 uniform scale from GLB

// GLTFLoader sanitizes dots in names: try variants + regex fallback.
function findMeshByName(scene, baseIdx /* "002" | "003" */) {
  const candidates = [`Mesh_0.${baseIdx}`, `Mesh_0_${baseIdx}`, `Mesh_0${baseIdx}`]
  for (const n of candidates) {
    const o = scene.getObjectByName(n)
    if (o) return o
  }
  let found = null
  const re = new RegExp(`^Mesh_0[._]?${baseIdx}$`, 'i')
  scene.traverse((o) => { if (!found && re.test(o.name)) found = o })
  return found
}

// Given a scene graph node that came from a GLTF node (may be an Object3D wrapping Meshes,
// or the Mesh itself), return the first renderable Mesh descendant.
function firstMeshOf(node) {
  if (!node) return null
  if (node.isMesh) return node
  let found = null
  node.traverse((o) => { if (!found && o.isMesh) found = o })
  return found
}

// Blender planes lie flat on the ground (local +Z is world +Y), so their exported
// quaternion contains a 90° tilt that would make an upright character mesh lie horizontally.
// We keep ONLY the Y-axis yaw (rotation around world up) so the airdrop characters stay
// vertical while still facing the direction the user set in Blender.
function yawOnlyQuat(q) {
  const full = new THREE.Quaternion(q[0], q[1], q[2], q[3])
  const euler = new THREE.Euler().setFromQuaternion(full, 'YXZ')
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0, 'YXZ'))
}

function buildInstanceMatrices(planes, sourceY, sourceScale) {
  const matrices = planes.map(([x, z, q]) => {
    const m = new THREE.Matrix4()
    const pos = new THREE.Vector3(x, sourceY, z)
    const quat = yawOnlyQuat(q)
    const scl = new THREE.Vector3(sourceScale, sourceScale, sourceScale)
    m.compose(pos, quat, scl)
    return m
  })
  return matrices
}

export default function HouseAirdrops() {
  const { scene } = useGLTF('/alon_house/house_scene-v1.glb')
  const ref1 = useRef()
  const ref2 = useRef()
  const [sources, setSources] = useState({ geom1: null, mat1: null, geom2: null, mat2: null })

  // Extract geometry + material from the source meshes, then hide/detach originals so
  // we don't render the un-instanced copy alongside the InstancedMesh.
  useEffect(() => {
    if (!scene) return
    const src003 = firstMeshOf(findMeshByName(scene, '003'))
    const src002 = firstMeshOf(findMeshByName(scene, '002'))
    if (!src003 || !src002) {
      console.warn('[HouseAirdrops] missing source meshes', { src003: !!src003, src002: !!src002 })
      return
    }
    // Detach originals from the scene graph (one-time mutation of shared GLB cache)
    if (src003.parent) src003.parent.remove(src003)
    if (src002.parent) src002.parent.remove(src002)
    setSources({
      geom1: src003.geometry,
      mat1: src003.material,
      geom2: src002.geometry,
      mat2: src002.material,
    })
  }, [scene])

  // Write instance matrices once geometry/material are ready.
  useEffect(() => {
    if (ref1.current && sources.geom1) {
      const mats = buildInstanceMatrices(AIRDROP_1_PLANES, SOURCE_Y_1, SOURCE_SCALE_1)
      mats.forEach((m, i) => ref1.current.setMatrixAt(i, m))
      ref1.current.instanceMatrix.needsUpdate = true
      ref1.current.computeBoundingSphere?.()
    }
    if (ref2.current && sources.geom2) {
      const mats = buildInstanceMatrices(AIRDROP_2_PLANES, SOURCE_Y_2, SOURCE_SCALE_2)
      mats.forEach((m, i) => ref2.current.setMatrixAt(i, m))
      ref2.current.instanceMatrix.needsUpdate = true
      ref2.current.computeBoundingSphere?.()
    }
  }, [sources])

  if (!sources.geom1 || !sources.geom2) return null
  return (
    <>
      <instancedMesh
        ref={ref1}
        args={[sources.geom1, sources.mat1, AIRDROP_1_PLANES.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={ref2}
        args={[sources.geom2, sources.mat2, AIRDROP_2_PLANES.length]}
        castShadow
        receiveShadow
      />
    </>
  )
}
