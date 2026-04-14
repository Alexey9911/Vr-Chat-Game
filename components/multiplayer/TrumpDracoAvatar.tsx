import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { validateModelUrl } from '../../lib/skins/validateModelUrl'

export default function TrumpDracoAvatar({ animation }: { animation?: string | null }) {
  const gltf = useGLTF('/trumpdraco-v1.glb') as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)

  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])
  const loggedRef = useRef(false)

  const animationMap: { [key: string]: string } = useMemo(() => ({
    'Idle': 'All_Night_Dance',
    'Run': 'Walking',
    'Punch': 'Arm_Circle_Shuffle',
    'Yes': 'Breakdance_1990',
    'Wave': 'Running',
    'Death': 'Shot_and_Blown_Back',
  }), []);

  useEffect(() => {
    const animationToPlay = (animation ? animationMap[animation] || animation : undefined);
    const pick = animationToPlay ? [animationToPlay].find((n) => actions[n]) ?? (names?.length ? names.find((n) => actions[n]) : undefined) : undefined;
    const action = pick ? actions[pick] : undefined
    if (!action) return
    if (process.env.NODE_ENV !== 'production' && !loggedRef.current) {
      loggedRef.current = true
      // console.info('[Trump Draco Avatar] Animations:', Object.keys(actions || {}))
    }
    action.reset().fadeIn(0.15).play()
    return () => {
      action.fadeOut(0.15)
    }
  }, [actions, names, animation, animationMap])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    validateModelUrl('/trumpdraco-v1.glb')
      .then((res) => {
        if (!res.ok) {
          // console.warn('[Trump Draco Avatar] Model validation failed:', res.reason)
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
    >
      <primitive object={clone} />
    </group>
  )
}
