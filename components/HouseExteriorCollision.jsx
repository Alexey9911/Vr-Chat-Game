import { useEffect } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import {
  registerCollisionMesh,
  unregisterCollisionMesh,
} from '../lib/collisionRef'

// Invisible collision meshes for exterior (house walls, garden perimeter w/ door hole, street perimeter).
// Loaded from a dedicated GLB so editing collisions in Blender doesn't require re-exporting the full scene.
// Must share the same offset as HouseScene (OX, OY, OZ) because meshes live in Blender world coords.
const OX = 190.12, OY = 1.1857, OZ = -88.67

const COLLISION_NODE_NAMES = [
  'casa_collision',
  'jardin_house_collision',
  'exterior_calle_collision',
]

export default function HouseExteriorCollision() {
  const gltf = useGLTF('/alon_house/collision house externo.glb')

  useEffect(() => {
    if (!gltf.scene) return
    const registered = []
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((child) => {
      if (!child.isMesh) return
      if (!COLLISION_NODE_NAMES.includes(child.name)) return
      // Force DoubleSide so raycaster hits regardless of normal direction
      // (fixes one-way pass-through when Blender normals point inward/outward).
      if (child.material) {
        child.material = child.material.clone()
        child.material.side = THREE.DoubleSide
      }
      child.visible = false
      child.updateMatrixWorld(true)
      registerCollisionMesh(child.name, child)
      registered.push(child.name)

      // Debug: log actual world-space AABB so we can verify alignment vs Blender
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

useGLTF.preload('/alon_house/collision house externo.glb')
