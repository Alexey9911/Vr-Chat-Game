import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations } from '@react-three/drei'
import { useGLTFKtx2 } from '../../hooks/useGLTFKtx2'
import { SkeletonUtils } from 'three-stdlib'
import { validateModelUrl } from '../../lib/skins/validateModelUrl'

export default function ElonAvatar({ animation }: { animation?: string | null }) {
  const gltf = useGLTFKtx2('/elonMusk2Anim_KTX2.glb') as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)

  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])
  const loggedRef = useRef(false)

  // Mapping standard animation names to actual model animation names
  const animationMap: { [key: string]: string } = useMemo(() => ({
    'Idle': 'anim1',
    'Run': 'anim2',
  }), []);

  // No normalization needed; render at model's intrinsic scale and position
  // const normalized = useMemo(() => {
  //   const scene = clone as THREE.Object3D
  //   const box = new THREE.Box3().setFromObject(scene)
  //   const size = new THREE.Vector3()
  //   box.getSize(size)
  //   const height = Math.max(0.0001, size.y)
  //   const targetHeight = 1.8
  //   const scale = 1; // Fixed scale to match ModeloAnimado.jsx
  //   const center = new THREE.Vector3()
  //   box.getCenter(center)
  //   const yMin = box.min.y
  //   return { scale, center, yMin }
  // }, [gltf])

  useEffect(() => {
    const animationToPlay = (animation ? animationMap[animation] || animation : undefined);
    const pick = animationToPlay ? [animationToPlay].find((n) => actions[n]) ?? (names?.length ? names.find((n) => actions[n]) : undefined) : undefined;
    const action = pick ? actions[pick] : undefined
    if (!action) return
    if (process.env.NODE_ENV !== 'production' && !loggedRef.current) {
      loggedRef.current = true
      // console.info('[Elon Avatar] Animations:', Object.keys(actions || {}))
    }
    action.reset().fadeIn(0.15).play()
    return () => { action.fadeOut(0.15) }
  }, [actions, names, animation])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    validateModelUrl('/elonMusk2Anim_KTX2.glb')
      .then((res) => {
        if (!res.ok) {
          // console.warn('[Elon Avatar] Model validation failed:', res.reason)
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
      // Render at intrinsic scale and position. If model is too high/low, manual adjustment may be needed here.
      // For now, assume model's origin is at its feet.
    >
      <primitive object={clone} />
    </group>
  )
}
