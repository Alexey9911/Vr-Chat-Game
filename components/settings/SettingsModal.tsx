import React from 'react'
import { useSettingsStore, type EnvironmentPreset } from '../../lib/settings/settingsStore'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { useKeyboardStore } from '../../lib/useKeyboardStore'
import { setGlobalVolumeMultiplier } from '../../lib/audio/musicSystem'
import { setMicVolumeMultiplier, setLocalMicGain } from '../../lib/audio/voiceChatSystem'

const ENVIRONMENT_OPTIONS: { value: EnvironmentPreset; label: string; description: string }[] = [
  { value: 'sunset', label: 'Sunset', description: 'Warm golden hour lighting' },
  { value: 'night', label: 'Night', description: 'Dark starry sky' },
  { value: 'warehouse', label: 'Warehouse', description: 'Indoor studio lighting' },
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
    closeModal,
    setVolume,
    setMicVolume,
    setLocalMicGain: setLocalMicGainStore,
    setEnvironment,
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
        style={{ maxWidth: '500px' }}
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

            <div className="skins-footer">
              <div className="skins-hint">Esc: close</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
