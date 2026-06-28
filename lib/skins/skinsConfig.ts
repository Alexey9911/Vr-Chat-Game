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
  // =========================================================================
  // ORDER MATTERS: this is the order shown in the SkinBar + lobby picker, and
  // SKINS[0] is the DEFAULT skin every new player gets.
  // Requested order: ansem (default) → alon → giga → fwog → bull → popcat →
  // tobaku → unc. chillhouse & pinguin were removed from the picker per the
  // user; their GLBs/avatars still exist on disk for later if needed.
  // =========================================================================
  {
    id: 'ansem',
    label: 'Ansem',
    paletteSupport: 'fixed',
    previewCamera: {
      position: [0, 1.55, 3.0],
      target: [0, 1.05, 0],
      fov: 35,
    },
    previewScale: 1,
    assets: {
      // Raw (uncompressed) GLB — TODO: optimize to KTX2 later.
      modelUrl: '/new_skins/ansem.glb',
    },
    cacheKey: 'v1',
  },
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
    id: 'giga',
    label: 'Giga',
    paletteSupport: 'fixed',
    previewCamera: {
      position: [0, 1.55, 3.0],
      target: [0, 1.05, 0],
      fov: 35,
    },
    previewScale: 1,
    assets: {
      modelUrl: '/new_skins/giga.glb',
    },
    cacheKey: 'v1',
  },
  {
    id: 'fwog',
    label: 'Fwog',
    paletteSupport: 'fixed',
    previewCamera: {
      position: [0, 1.55, 3.0],
      target: [0, 1.05, 0],
      fov: 35,
    },
    previewScale: 1,
    assets: {
      modelUrl: '/new_skins/fwog.glb',
    },
    cacheKey: 'v1',
  },
  {
    id: 'bull',
    label: 'Bull',
    paletteSupport: 'fixed',
    previewCamera: {
      position: [0, 1.55, 3.0],
      target: [0, 1.05, 0],
      fov: 35,
    },
    // bull/popcat were exported ~142x smaller than the char1 humanoids
    // (they render at ~0.012 units), so the preview needs a big scale-up.
    previewScale: 142,
    assets: {
      modelUrl: '/new_skins/bull.glb',
    },
    cacheKey: 'v1',
  },
  {
    id: 'popcat',
    label: 'Popcat',
    paletteSupport: 'fixed',
    previewCamera: {
      position: [0, 1.55, 3.0],
      target: [0, 1.05, 0],
      fov: 35,
    },
    // See bull above — same ~142x export-scale compensation.
    previewScale: 142,
    assets: {
      modelUrl: '/new_skins/popcat.glb',
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
]

export function getSkinById(id: string | null | undefined) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0]
}

