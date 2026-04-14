export type SkinId = string

export type ViewMode = 'firstPerson' | 'thirdPerson'

export type PaletteSupport = 'none' | 'fixed' | 'customizable'

export type SkinColors = {
  primary?: string
  secondary?: string
  accent?: string
}

export type CameraPreset = {
  position: [number, number, number]
  target: [number, number, number]
  fov?: number
}

export type SkinAssets = {
  modelUrl: string
  lodModelUrls?: string[]
}

export type SkinConfig = {
  id: SkinId
  label: string
  paletteSupport: PaletteSupport
  defaultColors?: SkinColors
  previewCamera: CameraPreset
  previewScale?: number // Optional scale override for the preview
  assets: SkinAssets
  cacheKey?: string
}

