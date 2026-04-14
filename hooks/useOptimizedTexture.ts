import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { DataTexture, RGBAFormat, Texture, TextureLoader, UnsignedByteType } from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

function toKtx2Path(publicPath: string) {
  const normalized = publicPath.startsWith('/') ? publicPath.slice(1) : publicPath
  const withoutExt = normalized.replace(/\.[^/.]+$/, '')
  return `/ktx2/${withoutExt}_KTX2.ktx2`
}

export function useOptimizedTexture(publicPath: string) {
  const { gl } = useThree()

  const mode = useMemo(() => {
    if (typeof window === 'undefined') return 'ktx2'
    const v = new URLSearchParams(window.location.search).get('assets')
    if (v === 'orig') return 'orig'
    if (v === 'ktx2') return 'ktx2'
    return process.env.NEXT_PUBLIC_USE_KTX2 === '0' ? 'orig' : 'ktx2'
  }, [])

  const ktx2Path = useMemo(() => toKtx2Path(publicPath), [publicPath])
  const [texture, setTexture] = useState<Texture | null>(null)

  const debug = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('debug') === '1'
  }, [])

  const placeholder = useMemo(() => {
    const data = new Uint8Array([255, 255, 255, 255])
    const t = new DataTexture(data, 1, 1, RGBAFormat, UnsignedByteType)
    t.needsUpdate = true
    return t
  }, [])

  useEffect(() => {
    let cancelled = false
    let current: Texture | null = null

    const loadOriginal = () =>
      new Promise<Texture>((resolve, reject) => {
        const loader = new TextureLoader()
        loader.load(publicPath, resolve, undefined, reject)
      })

    const loadKtx2 = () =>
      new Promise<Texture>((resolve, reject) => {
        const loader = new KTX2Loader()
        loader.setTranscoderPath('/ktx2/')
        loader.detectSupport(gl as any)
        loader.load(
          ktx2Path,
          (tex: Texture) => {
            loader.dispose()
            resolve(tex)
          },
          undefined,
          (e: any) => {
            loader.dispose()
            reject(e)
          }
        )
      })

    const run = async () => {
      try {
        const t = mode === 'ktx2' ? await loadKtx2().catch(() => loadOriginal()) : await loadOriginal()
        current = t
        if (!cancelled) setTexture(t)
      } catch (e) {
        if (debug) {
          // console.error('[useOptimizedTexture] Failed to load texture', {
          //   publicPath,
          //   ktx2Path,
          //   mode,
          //   error: e,
          // })
        }
        if (!cancelled) setTexture(null)
      }
    }

    setTexture(null)
    run()

    return () => {
      cancelled = true
      current?.dispose()
    }
  }, [debug, gl, ktx2Path, mode, publicPath])

  return texture ?? placeholder
}
