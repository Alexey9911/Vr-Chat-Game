import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'

const MODEL_URL = '/alon_house/skins/tobaku-v1.glb'

// Real GLB clips: Breakdance_1990, Burpee_Exercise, Fall1, Hip_Hop_Dance_3,
// Idle_6, Running, Walking, ymca_dance
export const TOBAKU_ANIMS = {
  idle: 'Breakdance_1990',
  walk: 'Fall1',
  run: 'Burpee_Exercise',
  emotes: [
    'Hip_Hop_Dance_3', // Emote 1
    'Idle_6',          // Emote 2
    'Running',         // Emote 3
    'Walking',         // Emote 4
    'ymca_dance',      // Emote 5
  ],
}

export default function TobakuAvatar({ animation }: { animation?: string | null }) {
  const gltf = useGLTF(MODEL_URL) as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)
  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])

  const animationMap: { [key: string]: string } = useMemo(() => ({
    Idle: TOBAKU_ANIMS.idle,
    Run: TOBAKU_ANIMS.walk,
    Sprint: TOBAKU_ANIMS.run,
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
