import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

// Singleton cache — one KTX2Loader per (renderer, transcoderPath). Previously every
// component that called useKtx2Loader created its OWN loader, which meant the Basis
// transcoder WASM was fetched/compiled N times (≥10 components in this project),
// blocking the main thread for several seconds right when the Lobby UI appeared
// and stealing keyboard focus from the nickname input.
const LOADER_CACHE = new WeakMap<object, Map<string, KTX2Loader>>()

export function useKtx2Loader(enabled: boolean, transcoderPath = '/ktx2/') {
  const { gl } = useThree()

  const loader = useMemo(() => {
    if (!enabled) return null
    let byPath = LOADER_CACHE.get(gl as any)
    if (!byPath) {
      byPath = new Map()
      LOADER_CACHE.set(gl as any, byPath)
    }
    const cached = byPath.get(transcoderPath)
    if (cached) return cached
    const l = new KTX2Loader()
    l.setTranscoderPath(transcoderPath)
    l.detectSupport(gl as any)
    byPath.set(transcoderPath, l)
    return l
  }, [enabled, gl, transcoderPath])

  // Do NOT dispose on unmount — the loader is shared. Disposing would break
  // any other component that still holds a reference.
  return loader
}
