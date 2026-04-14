import { useGLTF } from '@react-three/drei'
import { useKtx2Loader } from './useKtx2Loader'

export function useGLTFKtx2(path: string) {
  const ktx2Loader = useKtx2Loader(true)
  return useGLTF(path, undefined, undefined, (loader) => {
    loader.setKTX2Loader(ktx2Loader)
  })
}

