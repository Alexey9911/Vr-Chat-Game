import React from 'react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { useSkinStore } from '../../lib/skins/skinStore'
import { useIsMobile } from '../../hooks/useIsMobile'

// Emote keys per skin — matches useCameraControls animMap exactly
const SKIN_EMOTE_KEYS: Record<string, number[]> = {
  // TEMPORARILY DISABLED
  // 'elon': [],          // Only Idle + Run, no emotes
  // 'ai16z': [2, 3, 4], // 3 emotes (keys 2-4)
  chillhouse: [2, 3, 4, 5, 6, 7, 8], // 7 emotes
  tobaku: [2, 3, 4, 5, 6],           // 5 emotes
  unc: [2, 3, 4, 5, 6],              // 5 emotes
  pinguin: [2, 3, 4, 5, 6],          // 5 emotes
}
const DEFAULT_EMOTE_KEYS = [2, 3, 4, 5] // alon, elonmuskchibi, trumpskin

function triggerEmote(key: number) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: String(key), bubbles: true, cancelable: true }))
}

function getEmoteKeys(skinId: string | null): number[] {
  if (!skinId) return DEFAULT_EMOTE_KEYS
  return SKIN_EMOTE_KEYS[skinId] ?? DEFAULT_EMOTE_KEYS
}

export default function EmoteBar() {
  const { isConnected } = useMultiplayerStore()
  const { activeSkinId } = useSkinStore()
  const isMobile = useIsMobile()

  if (!isConnected) return null

  const emoteKeys = getEmoteKeys(activeSkinId)

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
