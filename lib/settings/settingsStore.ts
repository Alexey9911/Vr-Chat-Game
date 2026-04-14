import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EnvironmentPreset = 'sunset' | 'night' | 'warehouse'

type SettingsState = {
  isModalOpen: boolean
  isYouTubeModalOpen: boolean
  volume: number // 0-100 (music volume percentage)
  micVolume: number // 0-100 (other players' mic volume percentage)
  localMicGain: number // 0-100 (your mic gain percentage, 100=normal)
  environment: EnvironmentPreset

  openModal: () => void
  closeModal: () => void
  toggleModal: () => void
  toggleYouTubeModal: () => void
  closeYouTubeModal: () => void
  setVolume: (volume: number) => void
  setMicVolume: (volume: number) => void
  setLocalMicGain: (gain: number) => void
  setEnvironment: (env: EnvironmentPreset) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isModalOpen: false,
      isYouTubeModalOpen: false,
      volume: 50, // Default 50%
      micVolume: 100, // Default 100%
      localMicGain: 100, // Default 100%
      environment: 'sunset',

      openModal: () => set({ isModalOpen: true }),
      closeModal: () => set({ isModalOpen: false }),
      toggleModal: () => set((s) => ({ isModalOpen: !s.isModalOpen })),
      toggleYouTubeModal: () => set((s) => ({ isYouTubeModalOpen: !s.isYouTubeModalOpen })),
      closeYouTubeModal: () => set({ isYouTubeModalOpen: false }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
      setMicVolume: (volume) => set({ micVolume: Math.max(0, Math.min(100, volume)) }),
      setLocalMicGain: (gain) => set({ localMicGain: Math.max(0, Math.min(100, gain)) }),
      setEnvironment: (environment) => set({ environment }),
    }),
    {
      name: 'game-settings',
      partialize: (state) => ({
        volume: state.volume,
        micVolume: state.micVolume,
        localMicGain: state.localMicGain,
        environment: state.environment,
      }),
    }
  )
)
