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
  const gltf = useGLTF('/alon_house/rooms/room_completed-v1.glb')
  const ceilingGltf = useGLTF('/alon_house/rooms/techo_rooms-v2.glb')
  const physicsGltf = useGLTF('/alon_house/rooms_physics.glb')
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!physicsGltf.scene || !groupRef.current) return
    groupRef.current.updateMatrixWorld(true)

    const registered: string[] = []
    physicsGltf.scene.traverse((child: any) => {
      if (!child.isMesh) return
      child.visible = false
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
    </group>
  )
}

useGLTF.preload('/alon_house/rooms/room_completed-v1.glb')
useGLTF.preload('/alon_house/rooms/techo_rooms-v2.glb')
useGLTF.preload('/alon_house/rooms_physics.glb')
