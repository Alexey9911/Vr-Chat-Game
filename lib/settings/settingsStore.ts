import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EnvironmentPreset = 'sunset' | 'night' | 'warehouse'

// Keep the label list in one place — SettingsModal dropdown + ColorControls
// apply consume the same values. Labels are shown to the user so they are
// short and sweet; the THREE.*ToneMapping enum is resolved inside
// ColorControls so this file doesn't have to import three.
export type ToneMappingKey =
  | 'ACES Filmic'
  | 'Neutral (Khronos)'
  | 'AgX'
  | 'Cineon'
  | 'Reinhard'
  | 'Linear'
  | 'None'

type SettingsState = {
  isModalOpen: boolean
  isYouTubeModalOpen: boolean
  volume: number // 0-100 (music volume percentage)
  micVolume: number // 0-100 (other players' mic volume percentage)
  localMicGain: number // 0-100 (your mic gain percentage, 100=normal)
  environment: EnvironmentPreset

  // --- Video / colour settings (NOT persisted — reset on every reload) ---
  toneMapping: ToneMappingKey
  toneMappingExposure: number // 0-3
  envIntensity: number // 0-5 — HDRI light intensity
  bgIntensity: number // 0-5 — HDRI background brightness
  showBackground: boolean // draw HDRI as sky background

  openModal: () => void
  closeModal: () => void
  toggleModal: () => void
  toggleYouTubeModal: () => void
  closeYouTubeModal: () => void
  setVolume: (volume: number) => void
  setMicVolume: (volume: number) => void
  setLocalMicGain: (gain: number) => void
  setEnvironment: (env: EnvironmentPreset) => void
  setToneMapping: (t: ToneMappingKey) => void
  setToneMappingExposure: (v: number) => void
  setEnvIntensity: (v: number) => void
  setBgIntensity: (v: number) => void
  setShowBackground: (v: boolean) => void
  resetVideoSettings: () => void
}

// Centralised so both the store defaults and the `resetVideoSettings`
// action stay in sync if we tweak the starting values later.
const VIDEO_DEFAULTS = {
  toneMapping: 'Neutral (Khronos)' as ToneMappingKey,
  toneMappingExposure: 1.0,
  envIntensity: 1.4,
  bgIntensity: 1.0,
  showBackground: true,
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

      ...VIDEO_DEFAULTS,

      openModal: () => set({ isModalOpen: true }),
      closeModal: () => set({ isModalOpen: false }),
      toggleModal: () => set((s) => ({ isModalOpen: !s.isModalOpen })),
      toggleYouTubeModal: () => set((s) => ({ isYouTubeModalOpen: !s.isYouTubeModalOpen })),
      closeYouTubeModal: () => set({ isYouTubeModalOpen: false }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
      setMicVolume: (volume) => set({ micVolume: Math.max(0, Math.min(100, volume)) }),
      setLocalMicGain: (gain) => set({ localMicGain: Math.max(0, Math.min(100, gain)) }),
      setEnvironment: (environment) => set({ environment }),
      setToneMapping: (toneMapping) => set({ toneMapping }),
      setToneMappingExposure: (toneMappingExposure) => set({ toneMappingExposure }),
      setEnvIntensity: (envIntensity) => set({ envIntensity }),
      setBgIntensity: (bgIntensity) => set({ bgIntensity }),
      setShowBackground: (showBackground) => set({ showBackground }),
      resetVideoSettings: () => set({ ...VIDEO_DEFAULTS }),
    }),
    {
      name: 'game-settings',
      // Video / colour fields are INTENTIONALLY omitted — user asked for
      // them to reset on every reload instead of persisting to
      // localStorage. Audio + environment stay persisted as before.
      partialize: (state) => ({
        volume: state.volume,
        micVolume: state.micVolume,
        localMicGain: state.localMicGain,
        environment: state.environment,
      }),
    }
  )
)
