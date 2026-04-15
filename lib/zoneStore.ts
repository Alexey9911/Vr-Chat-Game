import { create } from 'zustand'

export type Zone = 'exterior' | 'interior' | 'balcon'

interface ZoneState {
  currentZone: Zone
  isTransitioning: boolean
  setZone: (zone: Zone) => void
  setTransitioning: (transitioning: boolean) => void
}

export const useZoneStore = create<ZoneState>((set) => ({
  currentZone: 'exterior',
  isTransitioning: false,
  setZone: (zone) => set({ currentZone: zone }),
  setTransitioning: (transitioning) => set({ isTransitioning: transitioning }),
}))
