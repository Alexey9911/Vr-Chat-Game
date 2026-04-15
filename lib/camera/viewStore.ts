import { create } from 'zustand'
import type { ViewMode } from '../skins/skinTypes'

type ViewState = {
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void
  toggleViewMode: () => void
  cinematicMode: boolean
  setCinematicMode: (v: boolean) => void
  toggleCinematicMode: () => void
}

export const useViewStore = create<ViewState>((set, get) => ({
  viewMode: 'thirdPerson',
  setViewMode: (m) => set({ viewMode: m }),
  toggleViewMode: () => set({ viewMode: get().viewMode === 'firstPerson' ? 'thirdPerson' : 'firstPerson' }),
  cinematicMode: false,
  setCinematicMode: (v) => set({ cinematicMode: v }),
  toggleCinematicMode: () => set({ cinematicMode: !get().cinematicMode }),
}))

