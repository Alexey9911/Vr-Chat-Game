import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'

const MODEL_URL = '/alon_house/skins/pinguin-v1.glb'

// Real GLB clips: All_Night_Dance, Breakdance_1990, Fall4, FunnyDancing_02,
// Hip_Hop_Dance_2, Idle_03, Running, Walking
export const PINGUIN_ANIMS = {
  idle: 'Walking',           // user: "Walking animacion de descanso"
  walk: 'Breakdance_1990',   // user: "Breakdance_1990 animacion de caminar"
  run: 'All_Night_Dance',    // user: "All_Night_Dance animacion de correr"
  emotes: [
    'Fall4',           // Emote 1
    'FunnyDancing_02', // Emote 2
    'Hip_Hop_Dance_2', // Emote 3
    'Idle_03',         // Emote 4
    'Running',         // Emote 5
  ],
}

export default function PinguinAvatar({ animation }: { animation?: string | null }) {
  const gltf = useGLTF(MODEL_URL) as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)
  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])

  const animationMap: { [key: string]: string } = useMemo(() => ({
    Idle: PINGUIN_ANIMS.idle,
    Run: PINGUIN_ANIMS.walk,
    Sprint: PINGUIN_ANIMS.run,
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

if (typeof window !== 'undefined') {
  setTimeout(() => useGLTF.preload(MODEL_URL), 100)
}
