export type AssetsMode = 'orig' | 'ktx2'

export function getAssetsMode(): AssetsMode {
  if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_USE_KTX2 === '0' ? 'orig' : 'ktx2'
  const v = new URLSearchParams(window.location.search).get('assets')
  if (v === 'orig') return 'orig'
  if (v === 'ktx2') return 'ktx2'
  return process.env.NEXT_PUBLIC_USE_KTX2 === '0' ? 'orig' : 'ktx2'
}

