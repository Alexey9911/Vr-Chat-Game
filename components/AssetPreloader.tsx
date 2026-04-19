import { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'

// Minimalist preloader — only the HEAVIEST non-KTX2 GLBs the player will
// definitely see on entry. Goal: move their download cost from "during
// the lobby typing session" to "while the loading overlay is visible".
//
// Rules of thumb for what goes in this list:
//   1. File must be > 2 MB (smaller files download in <200 ms each and
//      the loader progress bar makes more noise than signal with them).
//   2. Must NOT require the KTX2 loader. Plain `useGLTF.preload` uses
//      the default GLTFLoader; calling it on a KTX2-compressed GLB
//      throws "setKTX2Loader must be called before loading KTX2 textures".
//      The skin GLBs (`*_ktx2.glb`) go through `useGLTFKtx2` which wires
//      the decoder — they load on-demand when SkinPreviewCanvas /
//      AvatarComponent mounts. Attempting to preload them here breaks
//      the whole app.
//   3. Must be used during the lobby→world transition, not behind a
//      rare zone (e.g. art gallery) — otherwise we waste bandwidth.
//
// Current list (file sizes from `public/alon_house`):
//     girl-v1.glb              10.1 MB   ← biggest non-KTX2
//     room_completed-v1.glb     4.7 MB
//     house_scene-v1.glb        4.0 MB
//     alon_house-v1.glb         3.0 MB
//
// Everything else (<3 MB) loads fast enough that the Suspense boundaries
// on each component handle them gracefully without jank.
const HEAVY_GLB_URLS: string[] = [
  '/alon_house/rooms/girl-v1.glb',
  '/alon_house/rooms/room_completed-v1.glb?v=2',
  '/alon_house/house_scene-v1.glb',
  '/alon_house/alon_house-v1.glb',
]

export default function AssetPreloader() {
  useEffect(() => {
    for (const url of HEAVY_GLB_URLS) {
      try { useGLTF.preload(url) } catch (_) {}
    }
  }, [])
  return null
}
