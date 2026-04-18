import type { SkinConfig } from './skinTypes'

export const SKINS: SkinConfig[] = [
  // TEMPORARILY DISABLED for faster loading — uncomment to re-enable
  // {
  //   id: 'soldier',
  //   label: 'Soldier',
  //   paletteSupport: 'customizable',
  //   defaultColors: { primary: '#4a9eff' },
  //   previewCamera: {
  //     position: [0, 1.55, 3.8],
  //     target: [0, 1.05, 0],
  //     fov: 35,
  //   },
  //   assets: {
  //     modelUrl: '/models/Character_Soldier.gltf',
  //   },
  //   cacheKey: 'v1',
  // },
  // {
  //   id: 'elon',
  //   label: 'Elon Musk',
  //   paletteSupport: 'fixed',
  //   previewCamera: {
  //     position: [0, 0.9, 3.2],
  //     target: [0, 0.15, 0],
  //     fov: 35,
  //   },
  //   previewScale: 1,
  //   assets: {
  //     modelUrl: '/elonMusk2Anim_KTX2.glb',
  //     lodModelUrls: ['/elonMusk2Anim.glb', '/elonMusk2Anim_KTX2.glb'],
  //   },
  //   cacheKey: 'v1',
  // },
  {
    id: 'alon',
    label: 'Alon',
    paletteSupport: 'fixed',
    previewCamera: {
      position: [0, 1.55, 3.0],
      target: [0, 1.05, 0],
      fov: 35,
    },
    previewScale: 1,
    assets: {
      modelUrl: '/alonskin-v1_ktx2.glb',
    },
    cacheKey: 'v1',
  },
  {
    id: 'elonmuskchibi',
    label: 'Elon Chibi',
    paletteSupport: 'fixed',
    previewCamera: {
      position: [0, 1.55, 3.0],
      target: [0, 1.05, 0],
      fov: 35,
    },
    previewScale: 1,
    assets: {
      modelUrl: '/elonmuskchibi-v1_ktx2.glb',
    },
    cacheKey: 'v1',
  },
  // {
  //   id: 'ai16z',
  //   label: 'AI16Z',
  //   paletteSupport: 'fixed',
  //   previewCamera: {
  //     position: [0, 1.55, 3.0],
  //     target: [0, 1.05, 0],
  //     fov: 35,
  //   },
  //   previewScale: 1,
  //   assets: {
  //     modelUrl: '/ai16z-v1.glb',
  //   },
  //   cacheKey: 'v1',
  // },
  // {
  //   id: 'trumpdraco',
  //   label: 'Draco',
  //   paletteSupport: 'fixed',
  //   previewCamera: {
  //     position: [0, 1.55, 3.0],
  //     target: [0, 1.05, 0],
  //     fov: 35,
  //   },
  //   previewScale: 1,
  //   assets: {
  //     modelUrl: '/trumpdraco-v1.glb',
  //   },
  //   cacheKey: 'v1',
  // },
  {
    id: 'chillhouse',
    label: 'ChillHouse',
    paletteSupport: 'fixed',
    previewCamera: {
      position: [0, 1.55, 3.0],
      target: [0, 1.05, 0],
      fov: 35,
    },
    previewScale: 1,
    assets: {
      modelUrl: '/alon_house/skins/chillhouse-v1_ktx2.glb',
    },
    cacheKey: 'v1',
  },
  {
    id: 'tobaku',
    label: 'Tobaku',
    paletteSupport: 'fixed',
    previewCamera: {
      position: [0, 1.55, 3.0],
      target: [0, 1.05, 0],
      fov: 35,
    },
    previewScale: 1,
    assets: {
      modelUrl: '/alon_house/skins/tobaku-v1_ktx2.glb',
    },
    cacheKey: 'v1',
  },
  {
    id: 'unc',
    label: 'Unc',
    paletteSupport: 'fixed',
    previewCamera: {
      position: [0, 1.55, 3.0],
      target: [0, 1.05, 0],
      fov: 35,
    },
    previewScale: 1,
    assets: {
      modelUrl: '/alon_house/skins/unc-v1_ktx2.glb',
    },
    cacheKey: 'v1',
  },
  {
    id: 'pinguin',
    label: 'Pinguin',
    paletteSupport: 'fixed',
    previewCamera: {
      position: [0, 1.55, 3.0],
      target: [0, 1.05, 0],
      fov: 35,
    },
    previewScale: 1,
    assets: {
      modelUrl: '/alon_house/skins/pinguin-v1_ktx2.glb',
    },
    cacheKey: 'v1',
  },
]

export function getSkinById(id: string | null | undefined) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0]
}

