import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { validateModelUrl } from '../../lib/skins/validateModelUrl'
import { useGLTFKtx2 } from '../../hooks/useGLTFKtx2'

export default function TrumpSkinAvatar({ animation }: { animation?: string | null }) {
  const gltf = useGLTFKtx2('/trumpskin-v1_ktx2.glb') as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)

  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])
  const loggedRef = useRef(false)

  // Animation mapping for Trump Skin model
  // Extracted from trumpskin-v1.glb: All_Night_Dance, Arm_Circle_Shuffle, Breakdance_1990, Idle_11, Running, Shot_and_Blown_Back, Walking
  const animationMap: { [key: string]: string } = useMemo(() => ({
    'Idle': 'Shot_and_Blown_Back',  // Rest pose (user specified)
    'Run': 'Walking',               // Walk when moving
    'Punch': 'All_Night_Dance',     // Emote 1 (Key 2)
    'Yes': 'Breakdance_1990',       // Emote 2 (Key 3)
    'Wave': 'Arm_Circle_Shuffle',   // Emote 3 (Key 4)
    'Death': 'Idle_11',             // Emote 4 (Key 5)
  }), [])

  useEffect(() => {
    const animationToPlay = (animation ? animationMap[animation] || animation : undefined)
    const pick = animationToPlay ? [animationToPlay].find((n) => actions[n]) ?? (names?.length ? names.find((n) => actions[n]) : undefined) : undefined
    const action = pick ? actions[pick] : undefined
    if (!action) return
    if (process.env.NODE_ENV !== 'production' && !loggedRef.current) {
      loggedRef.current = true
      // console.info('[Trump Skin Avatar] Animations:', Object.keys(actions || {}))
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
    validateModelUrl('/trumpskin-v1_ktx2.glb')
      .then((res) => {
        if (!res.ok) {
          // console.warn('[Trump Skin Avatar] Model validation failed:', res.reason)
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

if (typeof window !== 'undefined') {
  // Preload skipped: useGLTF.preload would not set KTX2/Meshopt loaders
}
