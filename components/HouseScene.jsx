import React, { useRef, useEffect, useMemo } from 'react'
import { useGLTF, useAnimations, Text, Text3D, Billboard, Center } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'

// Offset to center Blender model at scene origin
// Model bbox center: (-190.12, 30.25, 88.67), ground Y ≈ -1.19
const OX = 190.12, OY = 1.1857, OZ = -88.67

// Plane positions (Blender coords) + offset
// Plane positions extracted from texto_autos_casa.glb (Blender coords) + HouseScene offset.
// Plane NODE NAME = text displayed.
const FLOATING_TEXTS = [
  { label: '$AlonHouse',       position: [-231.09 + OX, 54.26 + OY,  96.19 + OZ], style: 'alonverse',  fontSize: 8 },
  { label: 'Lamborghini Urus', position: [-268.09 + OX, 23.02 + OY, 107.37 + OZ], style: 'cybertruck', fontSize: 2.5 },
  { label: 'BMW M4',           position: [-273.81 + OX, 23.02 + OY,  51.14 + OZ], style: 'cybertruck', fontSize: 2.5 },
  { label: 'Bananamobile',     position: [-274.41 + OX, 23.02 + OY,  75.29 + OZ], style: 'cybertruck', fontSize: 2.5 },
  { label: 'Corvette C8',      position: [-271.96 + OX, 23.02 + OY, 137.87 + OZ], style: 'cybertruck', fontSize: 2.5 },
]

function FloatingTextItem({ label, position, style, fontSize }) {
  const ref = useRef()
  const baseY = position[1]
  const isAlonverse = style === 'alonverse'

  // Bob params: alonverse (AlonHouse) is bigger & faster, cars are subtle
  const bobSpeed = isAlonverse ? 3.2 : 1.2
  const bobAmp = isAlonverse ? 2.2 : 0.8

  useFrame((state) => {
    if (!ref.current) return
    ref.current.position.y = baseY + Math.sin(state.clock.elapsedTime * bobSpeed) * bobAmp
  })

  const color = isAlonverse ? '#FFD700' : '#C0C0C0'
  const outlineColor = isAlonverse ? '#B8860B' : '#606060'

  // For alonverse style, use true 3D text with extrude (physical depth, no camera-follow)
  // For cybertruck style, use billboard (always faces camera)
  if (isAlonverse) {
    return (
      <group ref={ref} position={position} rotation={[0, Math.PI / 2, 0]}>
        <Center>
          <Text3D
            font="/font1.json"
            size={fontSize}
            height={fontSize * 0.15}
            curveSegments={12}
            bevelEnabled
            bevelThickness={fontSize * 0.03}
            bevelSize={fontSize * 0.02}
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
              side={THREE.DoubleSide}
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

function HouseDancer() {
  // Separate GLB: only the dancer (char1 + Armature + Boom_Dance + other clips)
  const gltf = useGLTF('/alon_house/alon_skin_house-v1.glb')
  const groupRef = useRef()
  const { actions } = useAnimations(gltf.animations, groupRef)

  const clone = useMemo(() => {
    const clonedScene = SkeletonUtils.clone(gltf.scene)
    clonedScene.traverse((child) => {
      if (child.isMesh) {
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

export default function HouseScene() {
  const gltf = useGLTF('/alon_house/house_scene-v1.glb')
  const sceneRef = useRef()

  useEffect(() => {
    if (!gltf.scene) return
    gltf.scene.traverse((child) => {
      // Hide the original char1/Armature — the animated clone in HouseDancer replaces it
      if (child.name === 'char1' || child.name === 'Armature') {
        child.visible = false
      }
      if (child.isMesh && child.name !== 'char1') {
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

        {/* Dancing alon skin decoration — loaded from separate alon_skin_house-v1.glb */}
        <HouseDancer />
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

if (typeof window !== 'undefined') {
  setTimeout(() => {
    useGLTF.preload('/alon_house/house_scene-v1.glb')
    useGLTF.preload('/alon_house/alon_skin_house-v1.glb')
  }, 100)
}
