import React from 'react'
import { useGLTF } from '@react-three/drei'

export default function Room1() {
  const gltf = useGLTF('/alon_house/rooms/room1.glb')

  return <primitive object={gltf.scene} />
}

useGLTF.preload('/alon_house/rooms/room1.glb')
