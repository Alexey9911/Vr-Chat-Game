import { useGLTF } from '@react-three/drei'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { useKtx2Loader } from './useKtx2Loader'

export function useGLTFKtx2(path: string) {
  const ktx2Loader = useKtx2Loader(true)
  return useGLTF(path, undefined, undefined, (loader) => {
    if (ktx2Loader) loader.setKTX2Loader(ktx2Loader)
    // Required when GLB was compressed with `gltf-transform meshopt`
    loader.setMeshoptDecoder(MeshoptDecoder as any)
  })
}

