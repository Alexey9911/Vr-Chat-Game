import { create } from 'zustand'
import type { SkinColors, SkinId } from './skinTypes'
import { SKINS } from './skinsConfig'

type SkinLoadState = {
  loaded: boolean
  lastError?: string
}

type SkinState = {
  isModalOpen: boolean
  selectedSkinIndex: number
  activeSkinId: SkinId
  colorsBySkinId: Record<string, SkinColors | undefined>
  loadBySkinId: Record<string, SkinLoadState | undefined>
  isTransitioning: boolean
  transitionToken: number

  openModal: () => void
  closeModal: () => void
  toggleModal: () => void

  setSelectedSkinIndex: (index: number) => void
  selectNext: () => void
  selectPrev: () => void

  setActiveSkinId: (skinId: SkinId) => void
  setSkinColors: (skinId: SkinId, colors: SkinColors) => void
  setSkinLoaded: (skinId: SkinId, loaded: boolean) => void
  setSkinError: (skinId: SkinId, error?: string) => void

  startTransition: () => number
  endTransition: (token: number) => void
}

function clampIndex(i: number) {
  const n = SKINS.length
  if (n <= 0) return 0
  return ((i % n) + n) % n
}

export const useSkinStore = create<SkinState>((set, get) => ({
  isModalOpen: false,
  selectedSkinIndex: 0,
  activeSkinId: SKINS[0]?.id ?? 'default',
  colorsBySkinId: Object.fromEntries(
    SKINS.map((s) => [s.id, s.defaultColors ? { ...s.defaultColors } : undefined])
  ),
  loadBySkinId: {},
  isTransitioning: false,
  transitionToken: 0,

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false, isTransitioning: false }),
  toggleModal: () => set((s) => ({ isModalOpen: !s.isModalOpen, isTransitioning: false })),

  setSelectedSkinIndex: (index) => set({ selectedSkinIndex: clampIndex(index) }),
  selectNext: () => set((s) => ({ selectedSkinIndex: clampIndex(s.selectedSkinIndex + 1) })),
  selectPrev: () => set((s) => ({ selectedSkinIndex: clampIndex(s.selectedSkinIndex - 1) })),

  setActiveSkinId: (skinId) => set({ activeSkinId: skinId }),
  setSkinColors: (skinId, colors) =>
    set((s) => ({
      colorsBySkinId: { ...s.colorsBySkinId, [skinId]: { ...(s.colorsBySkinId[skinId] ?? {}), ...colors } },
    })),
  setSkinLoaded: (skinId, loaded) =>
    set((s) => ({
      loadBySkinId: { ...s.loadBySkinId, [skinId]: { ...(s.loadBySkinId[skinId] ?? { loaded: false }), loaded } },
    })),
  setSkinError: (skinId, error) =>
    set((s) => ({
      loadBySkinId: { ...s.loadBySkinId, [skinId]: { ...(s.loadBySkinId[skinId] ?? { loaded: false }), lastError: error } },
    })),

  startTransition: () => {
    const next = get().transitionToken + 1
    set({ isTransitioning: true, transitionToken: next })
    return next
  },
  endTransition: (token) => {
    if (get().transitionToken !== token) return
    set({ isTransitioning: false })
  },
}))

