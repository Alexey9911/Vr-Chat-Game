import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { validateModelUrl } from '../../lib/skins/validateModelUrl'

export default function AdminSkinAvatar({ animation }: { animation?: string | null }) {
  const gltf = useGLTF('/adminskin.glb') as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)

  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])
  const loggedRef = useRef(false)

  // Animation mapping for Admin Skin model
  // NOTA: Estos nombres son PLACEHOLDERS - se actualizarán cuando se ejecute el script de extracción
  // Los nombres reales pueden estar "bugeados" (Idle → Running, etc.)
  const animationMap: { [key: string]: string } = useMemo(() => ({
    'Idle': 'Animation_0',      // Placeholder - Pose de descanso
    'Run': 'Animation_1',        // Placeholder - Caminar/correr
    'Punch': 'Animation_2',      // Placeholder - Emote 1
    'Yes': 'Animation_3',        // Placeholder - Baile 1
    'Wave': 'Animation_4',       // Placeholder - Baile 2
    'Death': 'Animation_5',      // Placeholder - Baile 3
  }), []);

  useEffect(() => {
    // Log available animations for debugging and updating the map
    if (process.env.NODE_ENV !== 'production' && !loggedRef.current) {
      loggedRef.current = true
      // console.info('='.repeat(60))
      // console.info('[ADMIN SKIN] Available Animations:')
      // console.info('Available names:', names)
      // console.info('Available actions:', Object.keys(actions || {}))
      // console.info('='.repeat(60))
      // console.info('[ADMIN SKIN] Current animation map (PLACEHOLDERS):')
      // console.info(animationMap)
      // console.info('='.repeat(60))
      // console.info('⚠️  IMPORTANT: Update animationMap with real names from above!')
      // console.info('='.repeat(60))
    }

    const animationToPlay = (animation ? animationMap[animation] || animation : undefined);
    const pick = animationToPlay ? [animationToPlay].find((n) => actions[n]) ?? (names?.length ? names.find((n) => actions[n]) : undefined) : undefined;
    const action = pick ? actions[pick] : undefined
    
    if (!action) {
      if (animation) {
        // console.warn(`[ADMIN SKIN] Animation "${animation}" not found. Mapped to: "${animationToPlay}"`)
      }
      return
    }

    // Configure looping behavior
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
    validateModelUrl('/adminskin.glb')
      .then((res) => {
        if (!res.ok) {
          // console.warn('[ADMIN SKIN] Model validation failed:', res.reason)
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
      scale={[1.875, 1.875, 1.875]}  // 1.5 (ai16z base) × 1.25 = 25% más grande
    >
      <primitive object={clone} />
    </group>
  )
}
