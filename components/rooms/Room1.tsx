import React, { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ROOM_Y_OFFSET, PHYSICS_EXTRA_Y } from '../../lib/roomsConfig'
import { registerCollisionMesh, unregisterCollisionMesh } from '../../lib/collisionRef'

// Unified rooms GLB (all rooms merged into a single /alon_house/rooms.glb).
// Previous per-room split (/alon_house/rooms/room1.glb) was retired.
//
// Rendered lifted by ROOM_Y_OFFSET so the exterior camera (far=350) cannot
// reach the interior geometry — keeps the rooms fully frustum-culled while
// the player is outside. The checkpoints use the same constant so spawn
// coords stay in sync without per-file edits.
//
// COLLISION: a dedicated /alon_house/rooms_physics.glb holds the simplified
// physics geometry (walls as planes, floor, obstacles) — exported from
// Blender WITHOUT applied solidify to keep tri count tiny. We load it
// hidden alongside the visual rooms.glb, register every mesh as a
// collision target, and rely on `DoubleSide` on the raycaster side so
// zero-thickness walls still block movement from both directions.
export default function Room1() {
  const gltf = useGLTF('/alon_house/rooms.glb')
  const physicsGltf = useGLTF('/alon_house/rooms_physics.glb')
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!physicsGltf.scene || !groupRef.current) return
    const registered: string[] = []
    // updateMatrixWorld must run AFTER the outer group's Y offset is
    // applied, otherwise the collision raycast would hit the meshes at
    // their un-lifted Blender coords (~311 world Y) instead of the lifted
    // position (~484).
    groupRef.current.updateMatrixWorld(true)
    physicsGltf.scene.traverse((child: any) => {
      if (!child.isMesh) return
      const id = `rooms_phys_${child.uuid}`
      // DoubleSide so the raycaster hits regardless of normal winding —
      // critical here because rooms_physics.glb is single-sided planes
      // (no applied solidify), so without this the player could pass
      // through walls approaching from the "back" side.
      if (child.material) {
        child.material = child.material.clone()
        child.material.side = THREE.DoubleSide
      }
      child.updateMatrixWorld(true)
      registerCollisionMesh(id, child)
      registered.push(id)
    })
    return () => {
      registered.forEach((id) => unregisterCollisionMesh(id))
    }
  }, [physicsGltf.scene])

  return (
    <group ref={groupRef} position={[0, ROOM_Y_OFFSET, 0]}>
      <primitive object={gltf.scene} />
      {/* Physics GLB mounted but wrapped in an invisible group so the
          renderer skips it entirely (R3F propagates `visible={false}` via
          Three.js's scene traversal short-circuit). We still need it in
          the scene graph so its world matrices track the ROOM_Y_OFFSET
          lift — the raycaster reads those matrices for collision. */}
      {physicsGltf.scene && (
        <group visible={false} position={[0, PHYSICS_EXTRA_Y, 0]}>
          <primitive object={physicsGltf.scene} />
        </group>
      )}
    </group>
  )
}

useGLTF.preload('/alon_house/rooms.glb')
useGLTF.preload('/alon_house/rooms_physics.glb')
