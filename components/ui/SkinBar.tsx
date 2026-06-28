import React from 'react'
import { SKINS } from '../../lib/skins/skinsConfig'
import { useSkinStore } from '../../lib/skins/skinStore'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { setLocalState as netSetLocalState } from '../../lib/net/netClient'

export default function SkinBar() {
  const { isConnected } = useMultiplayerStore()
  const { activeSkinId, setActiveSkinId, colorsBySkinId, setSelectedSkinIndex } = useSkinStore()

  function applySkin(skinId: string) {
    const skinIndex = SKINS.findIndex((s) => s.id === skinId)
    const skin = SKINS[skinIndex] ?? SKINS[0]

    const { localPlayerId, remotePlayers, updateRemotePlayer } = useMultiplayerStore.getState()
    if (!localPlayerId) return

    const prev = remotePlayers.get(localPlayerId)
    const colors = colorsBySkinId[skinId]
    const color = colors?.primary ?? prev?.color ?? '#4a9eff'

    const next = {
      skinId: skin.id,
      colors: colors ?? prev?.colors,
      color,
    }

    updateRemotePlayer(localPlayerId, next)
    netSetLocalState(next)

    setActiveSkinId(skin.id)
    setSelectedSkinIndex(skinIndex >= 0 ? skinIndex : 0)
  }

  if (!isConnected) return null

  return (
    <div className="skin-bar">
      {SKINS.map((skin, i) => (
        <button
          key={skin.id}
          className={`skin-bar-item ${activeSkinId === skin.id ? 'active' : ''}`}
          onClick={() => applySkin(skin.id)}
          title={skin.label}
        >
          {/* Number badge shown on mobile (vertical bar). CSS toggles which
              one is visible depending on viewport width. */}
          <span className="skin-bar-index">{i + 1}</span>
          <span className="skin-bar-label">{skin.label}</span>
        </button>
      ))}
    </div>
  )
}
