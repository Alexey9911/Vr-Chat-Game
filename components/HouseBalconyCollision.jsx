import { useEffect } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import {
  registerCollisionMesh,
  unregisterCollisionMesh,
} from '../lib/collisionRef'

// Balcony floor collider loaded from `collision_house_2.glb`.
// The balcony is geometrically attached to the house (it overlaps with
// the exterior shell on Y), so a thin un-thickened plane here would be
// fine for ground detection — but we DO thicken the collision AABB by
// re-baking the geometry with a small Y-scale > 1 so that fast-moving
// players (sprinting + diagonal) can't tunnel through a single-frame
// contact. The raycasters in useCameraControls shoot downward from the
// player's eye, so a thicker slab guarantees a stable hit.
//
// Uses the same HouseScene offset (OX/OY/OZ) as the exterior-collision
// GLB so coords in Blender land in the right world position.

const OX = 190.12, OY = 1.1857, OZ = -88.67

// Extra Y thickness applied to the Plane.011 floor. 0.6 world-units is
// enough to cover 2–3 frames of sprint movement on a 60Hz tick without
// making the balcony visibly lift off the visual mesh below it.
const BALCONY_THICKNESS_Y = 0.6

export default function HouseBalconyCollision() {
  const gltf = useGLTF('/alon_house/collision_house_2.glb')

  useEffect(() => {
    if (!gltf.scene) return
    const registered = []
    gltf.scene.updateMatrixWorld(true)

    gltf.scene.traverse((child) => {
      if (!child.isMesh) return
      // Hide — these are purely collision shells.
      child.visible = false

      // Thicken the geometry along local Y so the floor becomes a slab.
      // Cloning avoids polluting the shared GLB cache (StrictMode double-
      // mount would otherwise thicken twice).
      if (!child.userData.__balconyThickened) {
        child.geometry = child.geometry.clone()
        child.geometry.scale(1, 1 + BALCONY_THICKNESS_Y, 1)
        child.userData.__balconyThickened = true
      }

      if (child.material) {
        child.material = child.material.clone()
        child.material.side = THREE.DoubleSide
      }
      child.updateMatrixWorld(true)
      registerCollisionMesh(`balcony_${child.name}`, child)
      registered.push(`balcony_${child.name}`)

      const box = new THREE.Box3().setFromObject(child)
      const size = new THREE.Vector3()
      const center = new THREE.Vector3()
      box.getSize(size)
      box.getCenter(center)
      // eslint-disable-next-line no-console
      console.log(
        `[balcony collision] ${child.name} world center:(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}) size:(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`
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

useGLTF.preload('/alon_house/collision_house_2.glb')
