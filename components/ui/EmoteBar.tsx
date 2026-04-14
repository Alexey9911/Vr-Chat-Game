import React from 'react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { useSkinStore } from '../../lib/skins/skinStore'

// Emote keys per skin — matches useCameraControls animMap exactly
const SKIN_EMOTE_KEYS: Record<string, number[]> = {
  // TEMPORARILY DISABLED
  // 'elon': [],          // Only Idle + Run, no emotes
  // 'ai16z': [2, 3, 4], // 3 emotes (keys 2-4)
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
          <span className="emote-bar-label">Emote {index + 1}</span>
        </button>
      ))}
    </div>
  )
}
