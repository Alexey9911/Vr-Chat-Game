import React, { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useZoneStore } from '../../lib/zoneStore'

interface CheckpointProps {
  position: [number, number, number]
  targetPosition: [number, number, number]
  targetRotation?: number
  glbPath?: string
  triggerDistance?: number
  targetZone: 'exterior' | 'interior' | 'balcon'
  onTeleport: (pos: THREE.Vector3, rot: number) => void
}

export default function Checkpoint({
  position,
  targetPosition,
  targetRotation = 0,
  glbPath,
  triggerDistance = 3,
  targetZone,
  onTeleport,
}: CheckpointProps) {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)
  const cooldownRef = useRef(0)
  const { setZone, setTransitioning, isTransitioning } = useZoneStore()

  // Load checkpoint GLB if provided
  const gltf = glbPath ? useGLTF(glbPath) : null

  useFrame((_, delta) => {
    if (!groupRef.current || isTransitioning) return

    // Animate checkpoint (bob up/down)
    timeRef.current += delta
    if (!glbPath) {
      groupRef.current.position.y = position[1] + Math.sin(timeRef.current * 3) * 0.3
    }

    // Cooldown
    if (cooldownRef.current > 0) {
      cooldownRef.current -= delta
      return
    }

    // Check proximity to player
    const dist = camera.position.distanceTo(new THREE.Vector3(...position))
    
    if (dist < triggerDistance) {
      // Trigger teleport
      setTransitioning(true)
      cooldownRef.current = 2 // 2 second cooldown after teleport

      // Delay teleport for fade effect
      setTimeout(() => {
        const newPos = new THREE.Vector3(...targetPosition)
        onTeleport(newPos, targetRotation)
        setZone(targetZone)
        
        // End transition after fade completes
        setTimeout(() => {
          setTransitioning(false)
        }, 600)
      }, 500)
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {glbPath && gltf ? (
        <primitive object={gltf.scene.clone()} />
      ) : (
        // Default checkpoint visual (yellow triangle marker)
        <group>
          {/* Outer glow ring */}
          <mesh rotation-x={-Math.PI / 2} position-y={0.1}>
            <ringGeometry args={[2, 2.5, 32]} />
            <meshBasicMaterial color="#ffff00" transparent opacity={0.3} side={THREE.DoubleSide} />
          </mesh>
          
          {/* Yellow triangle marker */}
          <mesh rotation-x={-Math.PI / 2}>
            <coneGeometry args={[0.8, 2, 3]} />
            <meshStandardMaterial 
              color="#ffff00" 
              emissive="#ffff00" 
              emissiveIntensity={0.5}
            />
          </mesh>
          
          {/* Arrow pointing up */}
          <mesh position-y={1.5}>
            <coneGeometry args={[0.5, 1, 3]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      )}
    </group>
  )
}

// Preload function for GLB checkpoints
export function preloadCheckpoint(path: string) {
  useGLTF.preload(path)
}
