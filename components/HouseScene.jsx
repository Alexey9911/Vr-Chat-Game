import React, { useRef, useEffect, useMemo } from 'react'
import { useGLTF, useAnimations, Text, Text3D, Billboard, Center } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'

// Offset to center Blender model at scene origin
// Model bbox center: (-190.12, 30.25, 88.67), ground Y ≈ -1.19
const OX = 190.12, OY = 1.1857, OZ = -88.67

// Plane positions (Blender coords) + offset
const FLOATING_TEXTS = [
  { label: '$AlonHouse', position: [-197.08+OX, 42.63+OY, 87.67+OZ], style: 'alonverse', fontSize: 4 },
  { label: 'Bananamobile', position: [-247.82+OX, 23.02+OY, 71.73+OZ], style: 'cybertruck', fontSize: 2.5 },
  { label: 'Cybertruck', position: [-243.83+OX, 23.02+OY, 102.84+OZ], style: 'cybertruck', fontSize: 2.5 },
  { label: 'Lamborghini', position: [-231.83+OX, 23.02+OY, 136.31+OZ], style: 'cybertruck', fontSize: 2.5 },
]

function FloatingTextItem({ label, position, style, fontSize }) {
  const ref = useRef()
  const baseY = position[1]

  useFrame((state) => {
    if (!ref.current) return
    ref.current.position.y = baseY + Math.sin(state.clock.elapsedTime * 1.2) * 0.8
  })

  const isAlonverse = style === 'alonverse'
  const color = isAlonverse ? '#FFD700' : '#C0C0C0'
  const outlineColor = isAlonverse ? '#B8860B' : '#606060'

  // For alonverse style, use true 3D text with extrude (physical depth)
  // For cybertruck style, use billboard (always faces camera)
  if (isAlonverse) {
    return (
      <group ref={ref} position={position} rotation={[0, Math.PI, 0]}>
        <Center>
          <Text3D
            font="/font1.json"
            size={fontSize}
            height={0.5}
            curveSegments={12}
            bevelEnabled
            bevelThickness={0.1}
            bevelSize={0.05}
            bevelOffset={0}
            bevelSegments={5}
          >
            {label}
            <meshStandardMaterial
              color='#FFD700'
              emissive='#FFA500'
              emissiveIntensity={0.8}
              metalness={0.7}
              roughness={0.3}
              toneMapped={false}
            />
          </Text3D>
        </Center>
      </group>
    )
  }

  return (
    <Billboard ref={ref} position={position} follow>
      <Text
        fontSize={fontSize}
        color={color}
        anchorX="center"
        anchorY="middle"
        font="/font1.ttf"
        outlineWidth={fontSize * 0.05}
        outlineColor={outlineColor}
      >
        {label}
        <meshStandardMaterial
          color={color}
          emissive={isAlonverse ? '#FFA500' : '#888888'}
          emissiveIntensity={0.5}
          metalness={isAlonverse ? 0.3 : 0.8}
          roughness={isAlonverse ? 0.4 : 0.2}
          toneMapped={false}
        />
      </Text>
    </Billboard>
  )
}

function HouseDancer({ gltf }) {
  const groupRef = useRef()
  const { actions } = useAnimations(gltf.animations, groupRef)

  // Clone the skinned mesh properly using SkeletonUtils (like AlonAvatar does)
  const clone = useMemo(() => {
    const clonedScene = SkeletonUtils.clone(gltf.scene)
    clonedScene.traverse((child) => {
      // Hide everything except the dancing character in this clone
      if (child.isMesh && child.name !== 'char1') {
        child.visible = false
      }
      // Enable shadows and ensure visibility for the character
      if (child.isMesh && child.name === 'char1') {
        child.visible = true
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return clonedScene
  }, [gltf.scene])

  useEffect(() => {
    if (!actions) return
    // Play Boom_Dance animation on infinite loop
    const action = actions['Boom_Dance']
    if (action) {
      action.reset().fadeIn(0.5).play()
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
    }
    return () => {
      if (action) action.fadeOut(0.5)
    }
  }, [actions])

  return <group ref={groupRef}><primitive object={clone} /></group>
}

// Global collision mesh for raycasting (accessed by useCameraControls)
export let houseCollisionMesh = null

export default function HouseScene() {
  const gltf = useGLTF('/alon_house/house_scene-v1.glb')
  const sceneRef = useRef()

  useEffect(() => {
    if (!gltf.scene) return
    gltf.scene.traverse((child) => {
      // Store collision geometry mesh for raycasting (keep invisible)
      if (child.name === 'colisiones') {
        child.visible = false
        houseCollisionMesh = child
      }
      // Hide the original char1/Armature — the animated clone in HouseDancer replaces it
      if (child.name === 'char1' || child.name === 'Armature') {
        child.visible = false
      }
      if (child.isMesh && child.name !== 'colisiones' && child.name !== 'char1') {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [gltf.scene])

  return (
    <>
      {/* Center the Blender model at scene origin */}
      <group position={[OX, OY, OZ]}>
        {/* House scene GLB (static geometry, char1 hidden) */}
        <primitive ref={sceneRef} object={gltf.scene} />

        {/* Dancing alon skin decoration — cloned with own animation mixer */}
        <HouseDancer gltf={gltf} />
      </group>

      {/* Floating 3D texts (positions already include offset) */}
      {FLOATING_TEXTS.map((t) => (
        <FloatingTextItem
          key={t.label}
          label={t.label}
          position={t.position}
          style={t.style}
          fontSize={t.fontSize}
        />
      ))}
    </>
  )
}

useGLTF.preload('/alon_house/house_scene-v1.glb')
