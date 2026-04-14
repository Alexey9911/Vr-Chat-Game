import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { validateModelUrl } from '../../lib/skins/validateModelUrl'

export default function ElonMuskChibiAvatar({ animation }: { animation?: string | null }) {
  const gltf = useGLTF('/elonmuskchibi-v1.glb') as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)

  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])
  const loggedRef = useRef(false)

  // Animation mapping for Elon Musk Chibi model
  // Extracted from elonmuskchibi-v1.glb: All_Night_Dance, Arm_Circle_Shuffle, Breakdance_1990, Cheer_with_Both_Hands (skip), Dive_Down_and_Land_2, Idle_7, Running (skip), Walking
  const animationMap: { [key: string]: string } = useMemo(() => ({
    'Idle': 'Breakdance_1990',          // Rest pose (user specified)
    'Run': 'Dive_Down_and_Land_2',      // Movement animation (user specified)
    'Punch': 'All_Night_Dance',         // Emote 1 (Key 2)
    'Yes': 'Arm_Circle_Shuffle',        // Emote 2 (Key 3)
    'Wave': 'Walking',                  // Emote 3 (Key 4) - repurposed as dance
    'Death': 'Idle_7',                  // Emote 4 (Key 5) - repurposed as dance
  }), [])

  useEffect(() => {
    const animationToPlay = (animation ? animationMap[animation] || animation : undefined)
    const pick = animationToPlay ? [animationToPlay].find((n) => actions[n]) ?? (names?.length ? names.find((n) => actions[n]) : undefined) : undefined
    const action = pick ? actions[pick] : undefined
    if (!action) return
    if (process.env.NODE_ENV !== 'production' && !loggedRef.current) {
      loggedRef.current = true
      // console.info('[Elon Musk Chibi Avatar] Animations:', Object.keys(actions || {}))
    }
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    ;(action as any).clampWhenFinished = false
    action.fadeIn(0.15).play()
    return () => {
      action.fadeOut(0.15)
    }
  }, [actions, names, animation, animationMap])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    validateModelUrl('/elonmuskchibi-v1.glb')
      .then((res) => {
        if (!res.ok) {
          // console.warn('[Elon Musk Chibi Avatar] Model validation failed:', res.reason)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    clone.traverse((o: any) => {
      if (o && o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }, [clone])

  return (
    <group
      ref={group}
      scale={[1.5, 1.5, 1.5]}
    >
      <primitive object={clone} />
    </group>
  )
}
