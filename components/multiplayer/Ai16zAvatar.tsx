import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { validateModelUrl } from '../../lib/skins/validateModelUrl'

export default function Ai16zAvatar({ animation }: { animation?: string | null }) {
  const gltf = useGLTF('/ai16z-v1.glb') as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)

  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])
  const loggedRef = useRef(false)

  // Animation mapping for AI16Z model
  const animationMap: { [key: string]: string } = useMemo(() => ({
    'Idle': 'Running',           // ✅ Pose de descanso (según usuario)
    'Run': 'All_Night_Dance',    // ✅ Correr al moverse (según usuario)
    'Punch': 'Fast_Lightning',   // Tecla 2 (no usar, pero mapeado a algo neutro)
    'Yes': 'Hip_Hop_Dance_4',    // Tecla 3 → Hip Hop Dance 4
    'Wave': 'Breakdance_1990',   // Tecla 4 → Breakdance
    'Death': 'All_Night_Dance',  // Tecla 5 → Dance
  }), []);

  useEffect(() => {
    const animationToPlay = (animation ? animationMap[animation] || animation : undefined);
    const pick = animationToPlay ? [animationToPlay].find((n) => actions[n]) ?? (names?.length ? names.find((n) => actions[n]) : undefined) : undefined;
    const action = pick ? actions[pick] : undefined
    if (!action) return
    if (process.env.NODE_ENV !== 'production' && !loggedRef.current) {
      loggedRef.current = true
      // console.info('[AI16Z Avatar] Animations:', Object.keys(actions || {}))
    }
    // Configure looping behavior: Idle should be a continuous natural idle cycle.
    action.reset()
    if (animation === 'Idle') {
      action.setLoop(THREE.LoopRepeat, Infinity)
      ;(action as any).clampWhenFinished = false
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity)
      ;(action as any).clampWhenFinished = false
    }
    action.fadeIn(0.15).play()
    return () => {
      action.fadeOut(0.15)
    }
  }, [actions, names, animation, animationMap])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    validateModelUrl('/ai16z-v1.glb')
      .then((res) => {
        if (!res.ok) {
          // console.warn('[AI16Z Avatar] Model validation failed:', res.reason)
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
