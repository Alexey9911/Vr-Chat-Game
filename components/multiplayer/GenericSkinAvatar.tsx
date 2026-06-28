import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import { useGLTFKtx2 } from '../../hooks/useGLTFKtx2'
import { getSkinMovementMap, getSkinAnimation } from '../../lib/skins/skinAnimations'

// Generic avatar for the NEW skins (ansem, giga, fwog, bull, popcat).
//
// Per-skin internal scale, normalized by each model's MEASURED rest-pose render
// height so they all end up the same in-world size. The char1 humanoids render
// at ~1.7 units, but bull/popcat were exported ~142x smaller (they actually
// render at ~0.012 units), so they need a correspondingly larger scale-up.
// (Box3 auto-normalization can't be used here: for these skinned meshes it
// measures bind-pose geometry / node transforms that don't match the rendered
// size, which made bull/popcat shoot off-screen.)
//
// TARGET_LOCAL = 2.55 = char1(1.7) * 1.5, i.e. the same internal height as the
// existing small-rig avatars (TobakuAvatar/UncAvatar use scale 1.5). The
// external 5.0 in RemotePlayerAvatar then matches their in-world size; the new
// skins use feet-at-origin (yOffset 0) since they were measured with feetY≈0.
const TARGET_LOCAL = 2.55
const SKIN_RENDER_HEIGHT: Record<string, number> = {
  ansem: 1.7,
  giga: 1.7,
  fwog: 1.7,
  bull: 0.012,
  popcat: 0.012,
}

export default function GenericSkinAvatar({
  modelUrl,
  skinId,
  animation,
}: {
  modelUrl: string
  skinId: string
  animation?: string | null
}) {
  const gltf = useGLTFKtx2(modelUrl) as any
  const group = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations ?? [], group)
  const clone = useMemo(() => SkeletonUtils.clone(gltf.scene as THREE.Object3D), [gltf.scene])

  const movementMap = useMemo(() => getSkinMovementMap(skinId), [skinId])
  const internalScale = TARGET_LOCAL / (SKIN_RENDER_HEIGHT[skinId] ?? 1.7)

  // Track the currently-playing clip so a no-op state change doesn't restart
  // it. This keeps the animal skins (whose Idle/Run/Sprint all map to the SAME
  // single clip) walking smoothly instead of re-triggering on every start/stop.
  const currentActionRef = useRef<THREE.AnimationAction | null>(null)
  const currentClipRef = useRef<string | null>(null)

  useEffect(() => {
    const idle = getSkinAnimation(skinId)?.idle
    const requested = animation ? (movementMap[animation] || animation) : idle
    if (!requested) return

    // Resolve to an actual action; fall back to the first available clip.
    const clip =
      (actions[requested] ? requested : undefined) ??
      (names?.length ? names.find((n) => actions[n]) : undefined)
    if (!clip) return

    // Already playing this exact clip → nothing to do (prevents flicker).
    if (currentClipRef.current === clip && currentActionRef.current) return

    const next = actions[clip]
    if (!next) return

    const prev = currentActionRef.current
    if (prev && prev !== next) prev.fadeOut(0.15)

    next.reset()
    next.setLoop(THREE.LoopRepeat, Infinity)
    ;(next as any).clampWhenFinished = false
    next.fadeIn(0.15).play()

    currentActionRef.current = next
    currentClipRef.current = clip
  }, [actions, names, animation, movementMap, skinId])

  useEffect(() => {
    clone.traverse((o: any) => {
      if (o && o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }, [clone])

  return (
    <group ref={group} scale={[internalScale, internalScale, internalScale]}>
      <primitive object={clone} />
    </group>
  )
}

// Preload skipped: useGLTFKtx2 wires the loaders the raw GLBs don't strictly
// need, but useGLTF.preload would bypass them.
