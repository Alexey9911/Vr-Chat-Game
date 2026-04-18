import React, { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'
import { ROOM_Y_OFFSET } from '../../lib/roomsConfig'

// Dance NPC for the interior rooms.
//
// Source GLB already has `char1` + `Armature` authored at the correct
// Blender world position of the room where the user placed it, so we
// don't need to hand-place anything — we just need the same vertical
// lift (ROOM_Y_OFFSET) that rooms.glb / rooms_physics.glb receive, so
// the dancer lands on the physics floor. Mirrors the HouseDancer
// pattern in HouseScene.jsx exactly (load → SkeletonUtils.clone →
// useAnimations → play looping).
//
// Animation pick: the user asked for the SHORTEST clip. We sort by
// AnimationClip.duration and pick index 0, so if the clip list changes
// in the future we auto-adapt without editing code.
const GLB_URL = '/alon_house/rooms/fdsfasdfsdaasdf-v1.glb'

export default function RoomDancer() {
  const gltf: any = useGLTF(GLB_URL)
  const groupRef = useRef<THREE.Group>(null)

  const clone = useMemo(() => {
    if (!gltf.scene) return null
    const cloned = SkeletonUtils.clone(gltf.scene)
    cloned.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        child.frustumCulled = false
      }
    })
    return cloned
  }, [gltf.scene])

  const { actions, mixer } = useAnimations(gltf.animations || [], groupRef)

  useEffect(() => {
    if (!actions || !gltf.animations || gltf.animations.length === 0) return

    // Pick the shortest clip by duration.
    const shortest = [...gltf.animations].sort(
      (a: THREE.AnimationClip, b: THREE.AnimationClip) => a.duration - b.duration
    )[0]
    const action = actions[shortest.name]
    if (!action) return

    action.reset().fadeIn(0.3).play()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false

    return () => {
      try { action.fadeOut(0.3) } catch (_) {}
    }
  }, [actions, gltf.animations])

  if (!clone) return null

  return (
    <group ref={groupRef} position={[0, ROOM_Y_OFFSET, 0]}>
      <primitive object={clone} />
    </group>
  )
}

useGLTF.preload(GLB_URL)
