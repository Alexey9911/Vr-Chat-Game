import { create } from 'zustand'
import type { ViewMode } from '../skins/skinTypes'

type ViewState = {
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void
  toggleViewMode: () => void
}

export const useViewStore = create<ViewState>((set, get) => ({
  viewMode: 'thirdPerson',
  setViewMode: (m) => set({ viewMode: m }),
  toggleViewMode: () => set({ viewMode: get().viewMode === 'firstPerson' ? 'thirdPerson' : 'firstPerson' }),
}))

