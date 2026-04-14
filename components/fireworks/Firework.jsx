import * as THREE from 'three'
import React, { useState, useRef, useEffect } from 'react'
import { useFrame, extend } from '@react-three/fiber'
import { UnrealBloomPass } from 'three-stdlib'

extend({ UnrealBloomPass })

function Particle({ position, color }) {
  const velocityRef = useRef(
    new THREE.Vector3(
      Math.random() * 0.1 - 0.05,
      Math.random() * 0.12 - 0.05,
      Math.random() * 0.1 - 0.05
    )
  )

  const meshRef = useRef()

  useFrame(() => {
    if (!meshRef.current) return

    meshRef.current.position.add(velocityRef.current)
    velocityRef.current.y -= 0.0009

    if (meshRef.current.position.y < -1) {
      meshRef.current.geometry.dispose()
      meshRef.current.material.dispose()
      if (meshRef.current.parent) {
        meshRef.current.parent.remove(meshRef.current)
      }
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.02, 8, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        roughness={0.1}
        metalness={1}
      />
    </mesh>
  )
}

function Fireworks(props) {
  const [particles, setParticles] = useState([])
  const fireworkRef = useRef()

  useEffect(() => {
    const interval = setInterval(() => {
      if (!fireworkRef.current) return
      const pos = fireworkRef.current.position.clone()

      const newParticles = []
      for (let i = 0; i < 100; i++) {
        const color = new THREE.Color(Math.random() * 0xffffff)
        const position = new THREE.Vector3(pos.x, pos.y, pos.z)
        newParticles.push(
          <Particle key={Math.random()} position={position} color={color} />
        )
      }

      setParticles((prev) => [...prev, ...newParticles])
    }, 1500)

    return () => clearInterval(interval)
  }, [])

  // Limpiar partículas muertas cada frame
  useFrame(() => {
    setParticles((prev) => prev.filter(Boolean))
  })

  return (
    <mesh ref={fireworkRef} {...props}>
      <sphereGeometry args={[0.07, 8, 8]} />
      <meshBasicMaterial color="orange" />
      {particles}
    </mesh>
  )
}

export default Fireworks
