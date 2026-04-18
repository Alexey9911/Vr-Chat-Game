import { useEffect } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import {
  registerCollisionMesh,
  unregisterCollisionMesh,
} from '../lib/collisionRef'

// Invisible collision meshes for the 4 parked cars outside the house.
// Loads the source GLB so Blender transforms (Ctrl+A rotations, parent
// hierarchies, etc.) are respected exactly — the previous hardcoded AABB
// approach introduced imprecision when node rotations were baked into
// the geometry.
//
// DRAW CALLS: Each mesh is forced to `visible = false`, so Three.js skips
// rendering entirely → 0 draw calls for all 4 boxes. The only runtime
// cost is the bounding-box raycast in `hooks/useCameraControls.ts`
// (4 extra AABB intersections per step — negligible).
//
// Same offset as HouseScene / HouseExteriorCollision because meshes
// live in Blender world coords.
const OX = 190.12, OY = 1.1857, OZ = -88.67

const COLLISION_NODE_NAMES = ['car1', 'car2', 'car3', 'car4']

export default function CarsCollision() {
  const gltf = useGLTF('/alon_house/physics_cars.glb')

  useEffect(() => {
    if (!gltf.scene) return
    const registered = []
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((child) => {
      if (!child.isMesh) return
      if (!COLLISION_NODE_NAMES.includes(child.name)) return
      // DoubleSide so raycaster hits regardless of normal direction
      if (child.material) {
        child.material = child.material.clone()
        child.material.side = THREE.DoubleSide
      }
      child.visible = false
      child.updateMatrixWorld(true)
      registerCollisionMesh(child.name + '_collision', child)
      registered.push(child.name + '_collision')

      // Debug: verify world-space AABB vs Blender
      const box = new THREE.Box3().setFromObject(child)
      const size = new THREE.Vector3()
      const center = new THREE.Vector3()
      box.getSize(size)
      box.getCenter(center)
      // eslint-disable-next-line no-console
      console.log(
        `[collision] ${child.name} world center:(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}) size:(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`
      )
    })
    return () => {
      registered.forEach((id) => unregisterCollisionMesh(id))
    }
  }, [gltf.scene])

  if (!gltf.scene) return null
  return (
    <group position={[OX, OY, OZ]}>
      <primitive object={gltf.scene} />
    </group>
  )
}

useGLTF.preload('/alon_house/physics_cars.glb')
