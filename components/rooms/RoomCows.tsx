import React, { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { ROOM_Y_OFFSET } from '../../lib/roomsConfig'

// Cow decoration meshes next to the indian room.
// GLB: `vacas_indian_room.glb` — 3 static `Cow_mesh*` nodes authored in
// Blender world coords (Y ≈ 323–324, same as indian_character). Same
// ROOM_Y_OFFSET wrapper convention as RoomGirl / RoomDancer / Room1.
//
// Kept as a `<primitive>` of the loaded scene (no InstancedMesh) because
// there are only 3 nodes and each mesh is different — instancing would
// save nothing and complicate the material/UV mapping.
const GLB_URL = '/alon_house/rooms/vacas_indian_room.glb'

export default function RoomCows() {
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
    <group position={[0, ROOM_Y_OFFSET, 0]}>
      <primitive object={gltf.scene} />
    </group>
  )
}

useGLTF.preload(GLB_URL)
