import { useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'
import { useEffect } from 'react'
import * as THREE from 'three'

/**
 * Optimized GLTF loader with Draco and MeshOpt geometry compression support.
 * 
 * KTX2Loader was REMOVED because:
 * - No .ktx2 textures exist in the project — KTX2 was pure overhead
 * - The Basis WASM transcoder (~300KB fetch + compile) blocked Firefox's main thread
 *   for several seconds during loading, causing the freeze bug
 * 
 * Draco is kept because some models (e.g. logo.glb) use it.
 * MeshOpt is kept because it's a lightweight synchronous JS decoder.
 */
export function useOptimizedGLTF(path, options = {}) {
  const { gl } = useThree()
  const {
    enableMeshOpt = true,
    enableDraco = true,
    warmupGpu = false,
    convertToBasicMaterial = false,
  } = options

  const gltf = useLoader(
    GLTFLoader,
    path,
    (loader) => {
      // MeshOpt Decoder for compressed geometry (lightweight, no WASM)
      if (enableMeshOpt) {
        loader.setMeshoptDecoder(MeshoptDecoder)
      }

      // DRACO Loader for compressed geometry
      if (enableDraco) {
        try {
          const dracoLoader = new DRACOLoader()
          dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.5/')
          loader.setDRACOLoader(dracoLoader)
        } catch (error) {
          console.warn('[useOptimizedGLTF] DRACO loader failed, continuing without it:', error)
        }
      }
    }
  )

  // GPU Warmup - upload textures to VRAM during safe windows
  useEffect(() => {
    if (!warmupGpu || !gltf?.scene) return

    const texturesToWarmup = []

    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) 
          ? child.material 
          : [child.material]

        materials.forEach((mat) => {
          if (mat.map) texturesToWarmup.push(mat.map)
          if (mat.normalMap) texturesToWarmup.push(mat.normalMap)
          if (mat.roughnessMap) texturesToWarmup.push(mat.roughnessMap)
          if (mat.metalnessMap) texturesToWarmup.push(mat.metalnessMap)
          if (mat.aoMap) texturesToWarmup.push(mat.aoMap)
          if (mat.emissiveMap) texturesToWarmup.push(mat.emissiveMap)

          // Convert to MeshBasicMaterial if requested (for baked lighting)
          if (convertToBasicMaterial && mat.map && mat instanceof THREE.MeshStandardMaterial) {
            child.material = new THREE.MeshBasicMaterial({
              map: mat.map,
              transparent: mat.transparent,
              opacity: mat.opacity,
              side: mat.side,
            })
          }
        })
      }
    })

    // Upload all textures to GPU
    texturesToWarmup.forEach((texture) => {
      if (texture) {
        gl.initTexture(texture)
      }
    })

    // Pre-compile shaders
    const camera = gltf.scene.getObjectByProperty('isCamera', true)
    if (camera) {
      gl.compile(gltf.scene, camera)
    }
  }, [warmupGpu, gltf, gl, path, convertToBasicMaterial])

  return gltf
}

/**
 * Optimize texture settings for better performance and quality
 */
export function optimizeTexture(texture, gl, options = {}) {
  const {
    enableAnisotropy = true,
    enableMipmaps = true,
    colorSpace = THREE.SRGBColorSpace,
    flipY = false,
  } = options

  if (!texture) return

  texture.colorSpace = colorSpace
  texture.flipY = flipY

  if (enableMipmaps) {
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
  }

  if (enableAnisotropy) {
    texture.anisotropy = gl.capabilities.getMaxAnisotropy()
  }

  texture.needsUpdate = true

  return texture
}
