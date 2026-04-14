import React, { useState, useEffect, useRef } from 'react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'

const SKIN_COLORS = [
  { label: 'Electric Blue', hex: '#4a9eff' },
  { label: 'Crimson', hex: '#ff3b3b' },
  { label: 'Neon Green', hex: '#39ff14' },
  { label: 'Gold', hex: '#ffd700' },
  { label: 'Purple', hex: '#a855f7' },
  { label: 'Hot Pink', hex: '#ff6ec7' },
  { label: 'Cyan', hex: '#00e5ff' },
  { label: 'Orange', hex: '#ff6b00' },
  { label: 'White', hex: '#ffffff' },
  { label: 'Shadow', hex: '#1a1a2e' },
  { label: 'Lime', hex: '#7fff00' },
  { label: 'Magenta', hex: '#ff00ff' },
]

export default function SkinChanger() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#4a9eff')
  const playroomRef = useRef<any>(null)
  const { isConnected } = useMultiplayerStore()

  useEffect(() => {
    // @ts-ignore
    import('playroomkit').then((mod: any) => { playroomRef.current = mod })
  }, [])

  // Press C to toggle
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return
      if (e.key.toLowerCase() === 'c') {
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const applySkin = (color: string) => {
    setSelectedColor(color)
    const pk = playroomRef.current
    if (!pk) return
    const me = pk.myPlayer?.()
    if (!me) return
    const prev = me.getState('pdata') || {}
    me.setState('pdata', { ...prev, color }, true)
  }

  if (!isConnected || !isOpen) return null

  return (
    <div className="skin-changer-overlay" onClick={() => setIsOpen(false)}>
      <div className="skin-changer-panel" onClick={e => e.stopPropagation()}>
        <div className="skin-changer-title">🎨 Choose Your Skin</div>
        <div className="skin-changer-subtitle">Press C or Esc to close</div>

        <div className="skin-colors-grid">
          {SKIN_COLORS.map(({ label, hex }) => (
            <button
              key={hex}
              className={`skin-color-btn ${selectedColor === hex ? 'selected' : ''}`}
              style={{ '--skin-color': hex } as React.CSSProperties}
              onClick={() => applySkin(hex)}
              title={label}
            >
              <div className="skin-color-swatch" />
              <span className="skin-color-name">{label}</span>
            </button>
          ))}
        </div>

        <button className="skin-close-btn" onClick={() => setIsOpen(false)}>
          ✓ Confirm
        </button>
      </div>
    </div>
  )
}
