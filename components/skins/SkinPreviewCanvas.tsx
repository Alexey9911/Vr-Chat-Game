import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Detailed, OrbitControls, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { CharacterSoldier } from '../multiplayer/CharacterSoldier'
import { useGLTFKtx2 } from '../../hooks/useGLTFKtx2'
import type { SkinConfig, SkinColors } from '../../lib/skins/skinTypes'
import { SkeletonUtils } from 'three-stdlib'

function lerp3(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  a.lerp(b, t)
}

function CameraRig({ preset }: { preset: SkinConfig['previewCamera'] }) {
  const { camera } = useThree()
  const targetPos = useMemo(() => new THREE.Vector3(...preset.position), [preset.position])
  const targetLook = useMemo(() => new THREE.Vector3(...preset.target), [preset.target])
  const lookRef = useRef(new THREE.Vector3(...preset.target))

  useEffect(() => {
    if (typeof preset.fov === 'number' && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      ;(camera as THREE.PerspectiveCamera).fov = preset.fov
      ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
    }
  }, [camera, preset.fov])

  useFrame(() => {
    lerp3(camera.position, targetPos, 0.12)
    lerp3(lookRef.current, targetLook, 0.12)
    camera.lookAt(lookRef.current)
  })

  return null
}

function AutoRotate({ children, skinId }: { children: React.ReactNode; skinId: string }) {
  const g = useRef<THREE.Group>(null)
  useEffect(() => {
    if (g.current) g.current.rotation.y = 0
  }, [skinId])
  useFrame((_, delta) => {
    if (!g.current) return
    g.current.rotation.y += delta * 0.6
  })
  return <group ref={g}>{children}</group>
}

function GltfAvatar({ url, overrideScale, playClipName }: { url: string; overrideScale?: number; playClipName?: string }) {
  const isKtx2 = url.toLowerCase().includes('_ktx2') || url.toLowerCase().endsWith('.glb')
  const gltf = isKtx2 ? useGLTFKtx2(url) : useGLTF(url)
  const group = useRef<THREE.Group>(null)

  const { actions, names } = useAnimations((gltf as any).animations ?? [], group)

  const clone = useMemo(() => SkeletonUtils.clone((gltf as any).scene as THREE.Object3D), [(gltf as any).scene])

  const normalized = useMemo(() => {
    const scene = clone as THREE.Object3D
    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    box.getSize(size)
    const height = Math.max(0.0001, size.y)
    const targetHeight = 1.8
    const autoScale = targetHeight / height
    const scale = overrideScale ?? autoScale;
    const center = new THREE.Vector3()
    box.getCenter(center)
    const yMin = box.min.y
    return { scale, center, yMin }
  }, [clone, overrideScale])

  useEffect(() => {
    // Only play animation if explicitly requested by name
    if (!playClipName) {
      // No animation requested - stop all and show T-pose
      Object.values(actions).forEach((action: any) => {
        if (action) action.stop()
      })
      return
    }
    
    // Debug: Log available animations
    if (process.env.NODE_ENV !== 'production') {
    }
    
    // Stop ALL animations immediately and synchronously
    Object.values(actions).forEach((action: any) => {
      if (action && action.isRunning()) {
        action.stop()
        action.reset()
      }
    })
    
    // Get the requested animation action
    const action = actions[playClipName]
    
    if (!action) {
      return
    }
    
    // Play immediately without fade for instant preview
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.play()
    
    if (process.env.NODE_ENV !== 'production') {
    }
    
    // Cleanup: stop immediately on unmount
    return () => {
      if (action) {
        action.stop()
        action.reset()
      }
    }
  }, [actions, playClipName])

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
      scale={[normalized.scale, normalized.scale, normalized.scale]}
      position={[-normalized.center.x * normalized.scale, -normalized.yMin * normalized.scale, -normalized.center.z * normalized.scale]}
    >
      <primitive object={clone} />
    </group>
  )
}

function PreviewModel({ skin, colors }: { skin: SkinConfig; colors: SkinColors | undefined }) {
  // TEMPORARILY DISABLED: soldier preview — uncomment to re-enable
  // if (skin.id === 'soldier') {
  //   return <CharacterSoldier color={colors?.primary ?? '#4a9eff'} animation="Idle" weapon="AK" />
  // }

  const lodUrls = skin.assets.lodModelUrls?.length ? skin.assets.lodModelUrls : [skin.assets.modelUrl]
  const [hi, low] = lodUrls.length >= 2 ? lodUrls : [lodUrls[0], lodUrls[0]];

  // Preview rule:
  // - trumpskin: force play 'Idle_11' clip
  // - alon: force play 'Breakdance_1990' clip (idle pose)
  // - others: remain in bind/T-pose (no autoplay)
  const forceClip = skin.id === 'trumpskin' ? 'Idle_11' : skin.id === 'alon' ? 'Breakdance_1990' : undefined
  
  if (process.env.NODE_ENV !== 'production' && (skin.id === 'ai16z' || skin.id === 'trumpskin')) {
  }
  
  return (
    <Detailed distances={[0, 3.6]}>
      <GltfAvatar url={hi} overrideScale={skin.previewScale} playClipName={forceClip} />
      <GltfAvatar url={low} overrideScale={skin.previewScale} playClipName={forceClip} />
    </Detailed>
  );
}

function SkinPrefetch({ url }: { url: string }) {
  const isKtx2 = url.toLowerCase().includes('_ktx2') || url.toLowerCase().endsWith('.glb')
  if (isKtx2) {
    useGLTFKtx2(url)
    return null
  }
  useGLTF(url)
  return null
}

export default function SkinPreviewCanvas({
  skin,
  colors,
  neighborUrls,
  onLoaded,
  transparent,
}: {
  skin: SkinConfig
  colors: SkinColors | undefined
  neighborUrls: string[]
  onLoaded?: () => void
  transparent?: boolean
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="always"
      camera={{ position: [...skin.previewCamera.position] as any, fov: skin.previewCamera.fov ?? 35, near: 0.1, far: 100 }}
      gl={{ alpha: !!transparent, antialias: true }}
      onCreated={({ gl }) => {
        if (transparent) {
          gl.setClearColor(0x000000, 0)
        }
      }}
      style={transparent ? { background: 'transparent' } : undefined}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 6, 3]} intensity={1.1} />
      <CameraRig preset={skin.previewCamera} />
      <Suspense fallback={null}>
        <AutoRotate skinId={skin.id}>
          <PreviewModel skin={skin} colors={colors} />
        </AutoRotate>
        {neighborUrls.map((u) => (
          <SkinPrefetch key={u} url={u} />
        ))}
        <OnLoaded skinId={skin.id} onLoaded={onLoaded} />
      </Suspense>
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
    </Canvas>
  )
}

function OnLoaded({ skinId, onLoaded }: { skinId: string; onLoaded?: () => void }) {
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (last.current === skinId) return
    last.current = skinId
    onLoaded?.()
  }, [skinId, onLoaded])
  return null
}
