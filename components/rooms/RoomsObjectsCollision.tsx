import React, { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ROOM_Y_OFFSET } from '../../lib/roomsConfig'
import { registerCollisionMesh, unregisterCollisionMesh } from '../../lib/collisionRef'

// Collision meshes for individual objects INSIDE the rooms (sofas, desks,
// bed frames, etc. — anything the player shouldn't clip through).
// Authored in Blender in the same coords as `rooms_physics.glb`, so we
// reuse the same ROOM_Y_OFFSET wrapper — identical pattern to Room1.
//
// Kept as a separate component (instead of stuffing the meshes into
// rooms_physics.glb) so the artist can iterate on object colliders
// without re-exporting the whole physics file, and so we can preload it
// independently via AssetPreloader.
const GLB_URL = '/alon_house/rooms/collisions_rooms_objects.glb'

export default function RoomsObjectsCollision() {
  const gltf = useGLTF(GLB_URL)
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!gltf.scene || !groupRef.current) return
    groupRef.current.updateMatrixWorld(true)

    const registered: string[] = []
    gltf.scene.traverse((child: any) => {
      if (!child.isMesh) return
      child.visible = false
      child.updateMatrixWorld(true)
      const id = `rooms_obj_${child.uuid}`
      registerCollisionMesh(id, child)
      registered.push(id)
    })

    return () => {
      registered.forEach((id) => unregisterCollisionMesh(id))
    }
  }, [gltf.scene])

  if (!gltf.scene) return null
  return (
    <group ref={groupRef} position={[0, ROOM_Y_OFFSET, 0]}>
      <primitive object={gltf.scene} />
    </group>
  )
}

useGLTF.preload(GLB_URL)
