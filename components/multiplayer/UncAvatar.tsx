import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { useGLTFKtx2 } from '../../hooks/useGLTFKtx2'

const MODEL_URL = '/alon_house/skins/unc-v1_ktx2.glb'

// Real GLB clips: Breakdance_1990, Climb_Attempt_and_Fall_1, Denim_Pop_Dance,
// Fall1, FunnyDancing_01, Idle_4, Running, Walking
export const UNC_ANIMS = {
  idle: 'Denim_Pop_Dance',
  walk: 'FunnyDancing_01',
  run: 'Fall1',
  emotes: [
    'Breakdance_1990',           // Emote 1
    'Climb_Attempt_and_Fall_1',  // Emote 2
    'Idle_4',                    // Emote 3
    'Running',                   // Emote 4
    'Walking',                   // Emote 5
  ],
}

export default function UncAvatar({ animation }: { animation?: string | null }) {
  const gltf = useGLTFKtx2(MODEL_URL) as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)
  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])

  const animationMap: { [key: string]: string } = useMemo(() => ({
    Idle: UNC_ANIMS.idle,
    Run: UNC_ANIMS.walk,
    Sprint: UNC_ANIMS.run,
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
