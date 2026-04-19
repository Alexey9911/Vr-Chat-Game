import React from 'react'
import { useSettingsStore, type EnvironmentPreset, type ToneMappingKey } from '../../lib/settings/settingsStore'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { useKeyboardStore } from '../../lib/useKeyboardStore'
import { setGlobalVolumeMultiplier } from '../../lib/audio/musicSystem'
import { setMicVolumeMultiplier, setLocalMicGain } from '../../lib/audio/voiceChatSystem'

const ENVIRONMENT_OPTIONS: { value: EnvironmentPreset; label: string; description: string }[] = [
  { value: 'sunset', label: 'Sunset', description: 'Warm golden hour lighting' },
  { value: 'night', label: 'Night', description: 'Dark starry sky' },
  { value: 'warehouse', label: 'Warehouse', description: 'Indoor studio lighting' },
]

const TONEMAPPING_OPTIONS: { value: ToneMappingKey; description: string }[] = [
  { value: 'Neutral (Khronos)', description: 'Vibrant, preserves saturation (recommended)' },
  { value: 'ACES Filmic', description: 'Cinematic, slightly desaturated' },
  { value: 'AgX', description: 'Modern, natural-looking' },
  { value: 'Cineon', description: 'Film-like contrast' },
  { value: 'Reinhard', description: 'Soft, low contrast' },
  { value: 'Linear', description: 'Raw — burns highlights' },
  { value: 'None', description: 'No tonemapping at all' },
]

export default function SettingsModal() {
  const isConnected = useMultiplayerStore((s) => s.isConnected)
  const lobbyVisible = useMultiplayerStore((s) => s.lobbyVisible)
  const { chatActive } = useKeyboardStore()

  const {
    isModalOpen,
    volume,
    micVolume,
    localMicGain,
    environment,
    toneMapping,
    toneMappingExposure,
    envIntensity,
    bgIntensity,
    showBackground,
    closeModal,
    setVolume,
    setMicVolume,
    setLocalMicGain: setLocalMicGainStore,
    setEnvironment,
    setToneMapping,
    setToneMappingExposure,
    setEnvIntensity,
    setBgIntensity,
    setShowBackground,
    resetVideoSettings,
  } = useSettingsStore()

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    setGlobalVolumeMultiplier(newVolume / 100)
  }

  const handleMicVolumeChange = (newVolume: number) => {
    setMicVolume(newVolume)
    setMicVolumeMultiplier(newVolume / 100)
  }

  const handleLocalMicGainChange = (newGain: number) => {
    setLocalMicGainStore(newGain)
    setLocalMicGain(newGain / 100)
  }

  const isVisible = isConnected && isModalOpen

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as any
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing || chatActive || lobbyVisible) return
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeModal, chatActive, lobbyVisible])

  React.useEffect(() => {
    if (!isVisible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className="skins-modal-overlay" onClick={() => closeModal()}>
      <div
        className="skins-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        // `overflowY: auto` + capped height lets the video settings grow
        // without pushing the close button offscreen. Without this the
        // modal overflows on smaller viewports once the Environment /
        // Video sections are open.
        style={{ maxWidth: '500px', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <button className="skins-modal-close" type="button" onClick={() => closeModal()}>
          Close
        </button>

        <div className="skins-modal-grid">
          <div className="skins-info-col" style={{ gridColumn: '1 / -1' }}>
            <div className="skins-header">
              <div className="skins-title">Settings</div>
            </div>

            {/* MUSIC VOLUME CONTROL */}
            <div className="settings-section">
              <div className="settings-section-title">Music Volume</div>
              <div className="settings-section-description">
                Volume of skin music in the game
              </div>
              <div className="settings-slider-container">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="settings-slider"
                />
                <div className="settings-slider-value">{volume}%</div>
              </div>
            </div>

            {/* OTHER PLAYERS MIC VOLUME CONTROL */}
            <div className="settings-section">
              <div className="settings-section-title">Other Players Mic</div>
              <div className="settings-section-description">
                How loud you hear other players' microphones
              </div>
              <div className="settings-slider-container">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={micVolume}
                  onChange={(e) => handleMicVolumeChange(Number(e.target.value))}
                  className="settings-slider"
                />
                <div className="settings-slider-value">{micVolume}%</div>
              </div>
            </div>

            {/* YOUR MIC GAIN CONTROL */}
            <div className="settings-section">
              <div className="settings-section-title">Your Microphone</div>
              <div className="settings-section-description">
                How loud other players hear you
              </div>
              <div className="settings-slider-container">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={localMicGain}
                  onChange={(e) => handleLocalMicGainChange(Number(e.target.value))}
                  className="settings-slider"
                />
                <div className="settings-slider-value">{localMicGain}%</div>
              </div>
            </div>

            {/* ENVIRONMENT CONTROL */}
            <div className="settings-section">
              <div className="settings-section-title">Environment</div>
              <div className="settings-section-description">
                Change the lighting and atmosphere
              </div>
              <div className="settings-options-grid">
                {ENVIRONMENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`settings-option-btn ${environment === option.value ? 'selected' : ''}`}
                    onClick={() => setEnvironment(option.value)}
                  >
                    <div className="settings-option-label">{option.label}</div>
                    <div className="settings-option-description">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* VIDEO / COLOUR CONTROLS — not persisted. Reset on reload. */}
            <div className="settings-section">
              <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Video (temporary)</span>
                <button
                  type="button"
                  onClick={() => resetVideoSettings()}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'inherit',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Reset
                </button>
              </div>
              <div className="settings-section-description">
                Live colour / lighting tuning. Not saved — resets every time you reload the page.
              </div>

              {/* Tonemap selector */}
              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Tonemapping</div>
              <div className="settings-options-grid">
                {TONEMAPPING_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`settings-option-btn ${toneMapping === option.value ? 'selected' : ''}`}
                    onClick={() => setToneMapping(option.value)}
                  >
                    <div className="settings-option-label">{option.value}</div>
                    <div className="settings-option-description">{option.description}</div>
                  </button>
                ))}
              </div>

              {/* Exposure slider */}
              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                Exposure
              </div>
              <div className="settings-slider-container">
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.01}
                  value={toneMappingExposure}
                  onChange={(e) => setToneMappingExposure(Number(e.target.value))}
                  className="settings-slider"
                />
                <div className="settings-slider-value">{toneMappingExposure.toFixed(2)}</div>
              </div>

              {/* HDRI light intensity */}
              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                HDRI light intensity
              </div>
              <div className="settings-slider-container">
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.05}
                  value={envIntensity}
                  onChange={(e) => setEnvIntensity(Number(e.target.value))}
                  className="settings-slider"
                />
                <div className="settings-slider-value">{envIntensity.toFixed(2)}</div>
              </div>

              {/* Background intensity */}
              <div style={{ marginTop: 14, fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                Sky background intensity
              </div>
              <div className="settings-slider-container">
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.05}
                  value={bgIntensity}
                  onChange={(e) => setBgIntensity(Number(e.target.value))}
                  className="settings-slider"
                />
                <div className="settings-slider-value">{bgIntensity.toFixed(2)}</div>
              </div>

              {/* Show background toggle */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 14,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={showBackground}
                  onChange={(e) => setShowBackground(e.target.checked)}
                />
                Show HDRI as sky background
              </label>
            </div>

            <div className="skins-footer">
              <div className="skins-hint">Esc: close</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
