import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { useGLTFKtx2 } from '../../hooks/useGLTFKtx2'

const MODEL_URL = '/alon_house/skins/chillhouse-v1_ktx2.glb'

// Animation mapping for ChillHouse skin
// Real GLB clips: All_Night_Dance, Boom_Dance, Breakdance_1990, Confident_Strut,
// Fall1, Idle_3, Running, Shake_It_Off_Dance, Wake_Up_and_Look_Up, Walking
export const CHILLHOUSE_ANIMS = {
  idle: 'Confident_Strut',
  walk: 'Walking',
  run: 'Shake_It_Off_Dance', // prepared for SHIFT (not active yet)
  emotes: [
    'Running',              // Emote 1 (key 2)
    'Boom_Dance',           // Emote 2 (key 3)
    'Breakdance_1990',      // Emote 3 (key 4)
    'Fall1',                // Emote 4 (key 5)
    'Idle_3',               // Emote 5 (key 6)
    'All_Night_Dance',      // Emote 6 (key 7)
    'Wake_Up_and_Look_Up',  // Emote 7 (key 8)
  ],
}

export default function ChillHouseAvatar({ animation }: { animation?: string | null }) {
  const gltf = useGLTFKtx2(MODEL_URL) as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)
  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])

  const animationMap: { [key: string]: string } = useMemo(() => ({
    Idle: CHILLHOUSE_ANIMS.idle,
    Run: CHILLHOUSE_ANIMS.walk,
    Sprint: CHILLHOUSE_ANIMS.run,
  }), [])

  useEffect(() => {
    const animationToPlay = animation ? (animationMap[animation] || animation) : undefined
    const pick = animationToPlay
      ? [animationToPlay].find((n) => actions[n]) ?? (names?.length ? names.find((n) => actions[n]) : undefined)
      : undefined
    const action = pick ? actions[pick] : undefined
    if (!action) return
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    ;(action as any).clampWhenFinished = false
    action.fadeIn(0.15).play()
    return () => {
      action.fadeOut(0.15)
    }
  }, [actions, names, animation, animationMap])

  useEffect(() => {
    clone.traverse((o: any) => {
      if (o && o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }, [clone])

  return (
    <group ref={group} scale={[1.5, 1.5, 1.5]}>
      <primitive object={clone} />
    </group>
  )
}

// Preload skipped: useGLTF.preload would not set KTX2/Meshopt loaders
