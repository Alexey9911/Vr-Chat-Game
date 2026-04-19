import React, { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'

// Fence object decoration for the exterior of the house.
// GLB authored in Blender world coords matching HouseScene (same offset
// convention — mounted inside the same <group position={[OX, OY, OZ]}>).
const GLB_URL = '/alon_house/vallas_objecto.glb'

// Same offset constants as HouseScene.jsx. Exported there via magic
// numbers in-line, so we re-declare here (single source of truth would
// be nicer but would require touching 5 files).
const OX = 190.12
const OY = 1.1857
const OZ = -88.67

export default function VallasObject() {
  const gltf: any = useGLTF(GLB_URL)

  useEffect(() => {
    if (!gltf?.scene) return
    gltf.scene.traverse((c: any) => {
      if (c.isMesh) {
        c.castShadow = true
        c.receiveShadow = true
      }
    })
  }, [gltf?.scene])

  if (!gltf?.scene) return null
  return (
    <group position={[OX, OY, OZ]}>
      <primitive object={gltf.scene} />
    </group>
  )
}

useGLTF.preload(GLB_URL)
