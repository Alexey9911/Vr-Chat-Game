import React from 'react'
import { EMOTES, Emote } from '../../lib/emotes/emotesConfig'

interface GifBarProps {
  onGifSelect: (emote: Emote) => void
  onOpenPicker: () => void
}

export default function GifBar({ onGifSelect, onOpenPicker }: GifBarProps) {
  // Show all local emotes as favorites for compact display
  const favoriteGifs = EMOTES

  return (
    <div className="gif-bar-row">
      {favoriteGifs.map((emote) => (
        <button
          key={emote.id}
          className="gif-bar-item"
          onClick={() => onGifSelect(emote)}
          title={emote.name}
        >
          {emote.type === 'video' ? (
            <video
              src={emote.url}
              className="gif-bar-img"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img
              src={emote.url}
              alt={emote.name}
              className="gif-bar-img"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          )}
        </button>
      ))}

      {/* MORE button — right of local GIFs */}
      <button
        className="gif-bar-more-btn"
        onClick={onOpenPicker}
        title="Open GIF picker"
      >
        <span className="gif-bar-more-icon">🔍</span>
        <span className="gif-bar-more-text">MORE</span>
      </button>
    </div>
  )
}
