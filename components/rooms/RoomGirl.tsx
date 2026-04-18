import React, { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { ROOM_Y_OFFSET } from '../../lib/roomsConfig'

// Static girl model for the interior rooms. The GLB has NO animation
// clips (confirmed via glTF JSON-chunk dump — 0 animations, just a
// rigged mesh + bones) so we don't need useAnimations / mixer. The
// mesh + rootJoint are already translated in Blender world coords, so
// we only apply ROOM_Y_OFFSET on the wrapper — same convention as
// RoomDancer / Room1.
const GLB_URL = '/alon_house/rooms/girl-v1.glb'

export default function RoomGirl() {
  const gltf: any = useGLTF(GLB_URL)

  useEffect(() => {
    if (!gltf?.scene) return
    gltf.scene.traverse((c: any) => {
      if (c.isMesh) {
        c.castShadow = true
        c.receiveShadow = true
        // Frustum culling is still on: three.js will skip draw calls when
        // the camera is far away (e.g. outside the house). That saves CPU
        // submission + GPU fragment work — but NOT VRAM. See note in
        // nuevo_alon_house.md about camera.far vs VRAM.
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
