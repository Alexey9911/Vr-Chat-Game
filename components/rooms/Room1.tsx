import React, { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ROOM_Y_OFFSET } from '../../lib/roomsConfig'
import { registerCollisionMesh, unregisterCollisionMesh } from '../../lib/collisionRef'

// Interior rooms. Same pattern as HouseExteriorCollision:
//   - visual GLB (rooms.glb) rendered normally
//   - physics GLB (rooms_physics.glb) mounted at same lift, meshes
//     registered as raycast colliders then hidden per-mesh
// rooms_physics now has solidified thick walls in Blender, so no
// DoubleSide / material gymnastics needed.
export default function Room1() {
  const gltf = useGLTF('/alon_house/rooms/room_completed-v1.glb?v=2')
  const ceilingGltf = useGLTF('/alon_house/rooms/techo_rooms-v2.glb?v=2')
  const physicsGltf = useGLTF('/alon_house/rooms_physics.glb?v=2')
  // Visual-only patch: small chunk of geometry that fills a gap the user
  // spotted after updating the rooms objects (solidify pass). Rendered
  // inside the ROOM_Y_OFFSET group so it aligns with the rest of the
  // rooms exactly like all other room meshes.
  const fixBug1Gltf = useGLTF('/alon_house/rooms/fix_bug_1.glb')
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!physicsGltf.scene || !groupRef.current) return
    groupRef.current.updateMatrixWorld(true)

    const registered: string[] = []
    physicsGltf.scene.traverse((child: any) => {
      if (!child.isMesh) return
      child.visible = false
      // Force DoubleSide + refresh bounds for the same reason as
      // RoomsObjectsCollision: Blender's solidify modifier produces an
      // inner AND outer shell — depending on which side the raycast
      // hits first, the face normal may point the wrong way and the
      // slide response can push the player INTO the wall instead of
      // along it. DoubleSide makes the hit symmetric; the slide code
      // in useCameraControls additionally flips any backface normal
      // so the response is always correct.
      if (child.material) {
        child.material = child.material.clone()
        child.material.side = THREE.DoubleSide
      }
      if (child.geometry) {
        child.geometry.computeBoundingBox?.()
        child.geometry.computeBoundingSphere?.()
      }
      child.updateMatrixWorld(true)
      const id = `rooms_phys_${child.uuid}`
      registerCollisionMesh(id, child)
      registered.push(id)
    })

    return () => {
      registered.forEach((id) => unregisterCollisionMesh(id))
    }
  }, [physicsGltf.scene])

  return (
    <group ref={groupRef} position={[0, ROOM_Y_OFFSET, 0]}>
      <primitive object={gltf.scene} />
      {ceilingGltf.scene && <primitive object={ceilingGltf.scene} />}
      {physicsGltf.scene && <primitive object={physicsGltf.scene} />}
      {fixBug1Gltf.scene && <primitive object={fixBug1Gltf.scene} />}
    </group>
  )
}

useGLTF.preload('/alon_house/rooms/room_completed-v1.glb?v=2')
useGLTF.preload('/alon_house/rooms/techo_rooms-v2.glb?v=2')
useGLTF.preload('/alon_house/rooms_physics.glb?v=2')
useGLTF.preload('/alon_house/rooms/fix_bug_1.glb')
