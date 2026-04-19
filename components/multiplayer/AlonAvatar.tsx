import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { validateModelUrl } from '../../lib/skins/validateModelUrl'
import { useGLTFKtx2 } from '../../hooks/useGLTFKtx2'

const ALON_GLTF_SCALE_FIX = 5.6
const ALON_FEET_Y_OFFSET = 1.5

export default function AlonAvatar({ animation }: { animation?: string | null }) {
  const gltf = useGLTFKtx2('/alonskin-v1_ktx2.glb') as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)

  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])
  const loggedRef = useRef(false)

  // Animation mapping: standard names → model clip names
  const animationMap: { [key: string]: string } = useMemo(() => ({
    'Idle': 'Breakdance_1990',       // Rest pose (no movement)
    'Run': 'Hip_Hop_Dance_3',       // Movement animation (walking)
    'Sprint': 'Fall1',               // Sprint clip confirmed by user (2026-04-18)
    'Punch': 'Boom_Dance',           // Emote 1 (key 2)
    'Yes': 'Idle_3',                 // Emote 2 (key 3)
    'Wave': 'Running',               // Emote 3 (key 4)
    'Death': 'Walking',              // Emote 4 (key 5)
  }), []);

  useEffect(() => {
    const animationToPlay = (animation ? animationMap[animation] || animation : undefined);
    const pick = animationToPlay ? [animationToPlay].find((n) => actions[n]) ?? (names?.length ? names.find((n) => actions[n]) : undefined) : undefined;
    const action = pick ? actions[pick] : undefined
    if (!action) return
    if (process.env.NODE_ENV !== 'production' && !loggedRef.current) {
      loggedRef.current = true
      // console.info('[Alon Avatar] Animations:', Object.keys(actions || {}))
    }
    action.reset().fadeIn(0.15).play()
    return () => {
      action.fadeOut(0.15)
    }
  }, [actions, names, animation, animationMap])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    validateModelUrl('/alonskin-v1_ktx2.glb')
      .then((res) => {
        if (!res.ok) {
          // console.warn('[Alon Avatar] Model validation failed:', res.reason)
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
      <group scale={[ALON_GLTF_SCALE_FIX, ALON_GLTF_SCALE_FIX, ALON_GLTF_SCALE_FIX]} position={[0, ALON_FEET_Y_OFFSET, 0]}>
        <primitive object={clone} />
      </group>
    </group>
  )
}

// Defer preload to avoid Turbopack serving HTML instead of binary during startup
if (typeof window !== 'undefined') {
  // Preload skipped: useGLTF.preload would not set KTX2/Meshopt loaders
}
