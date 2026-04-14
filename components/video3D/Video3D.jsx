import React, { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export default function Video3D({
  src,
  sources,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  size = [1, 1],
  loop = true,
  autoplay = true,
  muted = true,
  preload = 'none',
}) {
  const meshRef = useRef()

  const [video] = useState(() => {
    const el = document.createElement('video')
    el.crossOrigin = 'anonymous'
    el.loop = loop
    el.muted = muted
    el.autoplay = autoplay
    el.playsInline = true
    el.preload = preload

    const srcCandidates = []
    if (sources?.webm) srcCandidates.push({ type: 'video/webm', src: sources.webm })
    if (sources?.mp4) srcCandidates.push({ type: 'video/mp4', src: sources.mp4 })
    if (src) srcCandidates.push({ type: 'video/mp4', src })

    let picked = null
    for (const c of srcCandidates) {
      const can = el.canPlayType(c.type)
      if (can === 'probably' || can === 'maybe') {
        picked = c
        break
      }
    }

    if (!picked && srcCandidates.length > 0) picked = srcCandidates[srcCandidates.length - 1]

    if (picked) el.src = picked.src
    return el
  })

  useEffect(() => {
    video.load()
    video.play().catch(() => {})
  }, [video])

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial toneMapped={false}>
        <videoTexture attach="map" args={[video]} />
      </meshBasicMaterial>
    </mesh>
  )
}
