import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

export function useKtx2Loader(enabled: boolean, transcoderPath = '/ktx2/') {
  const { gl } = useThree()

  const loader = useMemo(() => {
    if (!enabled) return null
    const l = new KTX2Loader()
    l.setTranscoderPath(transcoderPath)
    l.detectSupport(gl as any)
    return l
  }, [enabled, gl, transcoderPath])

  useEffect(() => {
    return () => {
      loader?.dispose()
    }
  }, [loader])

  return loader
}
