import React, { useRef, useEffect } from 'react'
import { SKINS } from '../../lib/skins/skinsConfig'
import { useSkinStore } from '../../lib/skins/skinStore'
import { useMultiplayerStore } from '../../lib/multiplayerStore'

export default function SkinBar() {
  const { isConnected } = useMultiplayerStore()
  const { activeSkinId, setActiveSkinId, colorsBySkinId, setSelectedSkinIndex } = useSkinStore()
  const playroomRef = useRef<any>(null)

  useEffect(() => {
    if (!isConnected) return
    import('playroomkit').then((mod: any) => {
      playroomRef.current = mod
    })
  }, [isConnected])

  function applySkin(skinId: string) {
    const pk = playroomRef.current
    const me = pk?.myPlayer?.()
    if (!me) return

    const skinIndex = SKINS.findIndex((s) => s.id === skinId)
    const skin = SKINS[skinIndex] ?? SKINS[0]

    const prev = me.getState('pdata') || {}
    const colors = colorsBySkinId[skinId]
    const color = colors?.primary ?? prev.color ?? '#4a9eff'

    me.setState(
      'pdata',
      {
        ...prev,
        skinId: skin.id,
        colors: colors ?? prev.colors,
        color,
      },
      true
    )

    setActiveSkinId(skin.id)
    setSelectedSkinIndex(skinIndex >= 0 ? skinIndex : 0)

    const { localPlayerId, updateRemotePlayer } = useMultiplayerStore.getState()
    if (localPlayerId) {
      updateRemotePlayer(localPlayerId, {
        skinId: skin.id,
        colors: colors ?? prev.colors,
        color,
      })
    }
  }

  if (!isConnected) return null

  return (
    <div className="skin-bar">
      {SKINS.map((skin) => (
        <button
          key={skin.id}
          className={`skin-bar-item ${activeSkinId === skin.id ? 'active' : ''}`}
          onClick={() => applySkin(skin.id)}
          title={skin.label}
        >
          <span className="skin-bar-label">{skin.label}</span>
        </button>
      ))}
    </div>
  )
}
