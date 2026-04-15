import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useZoneStore } from '../../lib/zoneStore'
import { teleportPlayer } from '../../lib/teleportController'
import { EYE_HEIGHT } from '../../lib/camera/cameraConstants'
import { localPlayerLive } from '../../lib/localPlayerRef'

// Checkpoint GLB position (from inspector)
const CHECKPOINT_POS: [number, number, number] = [-175.84, 3.15, 86.21]
const CHECKPOINT_MIN_Y = 3.15
const CHECKPOINT_MAX_Y = 16.06
const CHECKPOINT_HEIGHT = CHECKPOINT_MAX_Y - CHECKPOINT_MIN_Y // ~12.91

// Where to teleport when entering the house (room1 center)
const INTERIOR_POS = new THREE.Vector3(-141.60, 341.43 - 20, 87.89) // slightly below room center for floor level
const INTERIOR_ROT = 0 // radians — will be adjusted later

const TRIGGER_DISTANCE = 8 // units — how close player must be

// GTA SA gradient shader: yellow with opacity gradient (0.4 top → 1.0 bottom)
const gradientVertexShader = `
  varying float vLocalY;
  uniform float uMinY;
  uniform float uMaxY;
  
  void main() {
    // Normalize Y position within the mesh (0 = bottom, 1 = top)
    vLocalY = clamp((position.y - uMinY) / (uMaxY - uMinY), 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const gradientFragmentShader = `
  varying float vLocalY;
  uniform vec3 uColor;
  uniform float uOpacityTop;
  uniform float uOpacityBottom;
  
  void main() {
    // Gradient: bottom (tip) = full opacity, top = semi-transparent
    float opacity = mix(uOpacityBottom, uOpacityTop, vLocalY);
    gl_FragColor = vec4(uColor, opacity);
  }
`

export default function CheckpointEntryHouse() {
  const gltf = useGLTF('/alon_house/checkpoint_entry_house.glb')
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)
  const cooldownRef = useRef(0)

  // Apply gradient shader to all meshes in the GLB
  // We compute bounding box per-geometry so the gradient uses LOCAL-space Y (not world)
  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true)
    let meshCount = 0
    clone.traverse((child: any) => {
      if (child.isMesh) {
        meshCount++
        // Compute LOCAL bounding box from geometry
        child.geometry.computeBoundingBox()
        const bb = child.geometry.boundingBox
        const localMinY = bb ? bb.min.y : 0
        const localMaxY = bb ? bb.max.y : 1
        console.log('[Checkpoint GLB] mesh found:', child.name, 
          'localY range:', localMinY.toFixed(2), '→', localMaxY.toFixed(2),
          'vertices:', child.geometry.attributes.position?.count)

        child.material = new THREE.ShaderMaterial({
          vertexShader: gradientVertexShader,
          fragmentShader: gradientFragmentShader,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          uniforms: {
            uColor: { value: new THREE.Color('#ffdd00') },
            uMinY: { value: localMinY },
            uMaxY: { value: localMaxY },
            uOpacityTop: { value: 0.35 },
            uOpacityBottom: { value: 1.0 },
          },
        })
        child.renderOrder = 999
        child.frustumCulled = false
      }
    })
    console.log('[Checkpoint GLB] Total meshes found:', meshCount)
    return clone
  }, [gltf.scene])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Bob animation (up/down)
    timeRef.current += delta
    groupRef.current.position.y = Math.sin(timeRef.current * 2) * 0.8

    // Cooldown
    if (cooldownRef.current > 0) {
      cooldownRef.current -= delta
      return
    }

    // Don't trigger if already transitioning or already inside
    const { currentZone, isTransitioning, setZone, setTransitioning } = useZoneStore.getState()
    if (isTransitioning || currentZone === 'interior') return

    // Check proximity using PLAYER position (not camera — camera is 20 units behind in 3rd person)
    if (!localPlayerLive.ready) return
    const playerX = localPlayerLive.x
    const playerZ = localPlayerLive.z
    const dx = playerX - CHECKPOINT_POS[0]
    const dz = playerZ - CHECKPOINT_POS[2]
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < TRIGGER_DISTANCE) {
      console.log('[Checkpoint] TRIGGERED! Distance:', dist.toFixed(2))
      setTransitioning(true)
      cooldownRef.current = 3

      // Fade out (500ms) → teleport → fade in
      setTimeout(() => {
        teleportPlayer(INTERIOR_POS, INTERIOR_ROT)
        setZone('interior')

        setTimeout(() => {
          setTransitioning(false)
        }, 600)
      }, 500)
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  )
}

// Preload
useGLTF.preload('/alon_house/checkpoint_entry_house.glb')
