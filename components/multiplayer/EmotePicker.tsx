import React, { useState } from 'react'
import { EMOTES, Emote } from '../../lib/emotes/emotesConfig'

interface EmotePickerProps {
  onEmoteSelect: (emote: Emote) => void
  isOpen: boolean
  onClose: () => void
}

export default function EmotePicker({ onEmoteSelect, isOpen, onClose }: EmotePickerProps) {
  const [hoveredEmote, setHoveredEmote] = useState<string | null>(null)

  if (!isOpen) return null

  return (
    <div className="emote-picker-overlay" onClick={onClose}>
      <div className="emote-picker" onClick={(e) => e.stopPropagation()}>
        <div className="emote-picker-header">
          <h3>Emotes</h3>
          <button className="emote-picker-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="emote-picker-grid">
          {EMOTES.map((emote) => (
            <button
              key={emote.id}
              className="emote-picker-item"
              onClick={() => onEmoteSelect(emote)}
              onMouseEnter={() => setHoveredEmote(emote.id)}
              onMouseLeave={() => setHoveredEmote(null)}
              title={emote.name}
            >
              <img
                src={emote.url}
                alt={emote.name}
                className="emote-picker-img"
                loading="lazy"
              />
              {hoveredEmote === emote.id && (
                <div className="emote-picker-tooltip">{emote.name}</div>
              )}
            </button>
          ))}
        </div>

        {EMOTES.length === 0 && (
          <div className="emote-picker-empty">
            <p>No emotes available yet</p>
            <p className="emote-picker-hint">
              Add GIF files to /public/emotes/ and run <code>npm run optimize-emotes</code>
            </p>
          </div>
        )}

        <div className="emote-picker-footer">
          <p className="emote-picker-usage">
            Click an emote to insert it into your message
          </p>
        </div>
      </div>
    </div>
  )
}
