import React from 'react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { useSkinStore } from '../../lib/skins/skinStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { getSkinEmoteKeys } from '../../lib/skins/skinAnimations'

function triggerEmote(key: number) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: String(key), bubbles: true, cancelable: true }))
}

export default function EmoteBar() {
  const { isConnected } = useMultiplayerStore()
  const { activeSkinId } = useSkinStore()
  const isMobile = useIsMobile()

  if (!isConnected) return null

  // Number of dance buttons follows the skin's real emote count — skins with
  // no emotes (bull/popcat) render zero buttons instead of dead numbers.
  const emoteKeys = getSkinEmoteKeys(activeSkinId)

  if (emoteKeys.length === 0) return null

  return (
    <div className="emote-bar">
      {emoteKeys.map((k, index) => (
        <button
          key={k}
          className="emote-bar-item"
          onClick={() => triggerEmote(k)}
          title={`Emote ${index + 1} (${k})`}
        >
          <span className="emote-bar-label">
            {isMobile ? `E${index + 1}` : `Emote ${index + 1}`}
          </span>
        </button>
      ))}
    </div>
  )
}
