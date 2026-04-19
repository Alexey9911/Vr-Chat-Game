import React, { useEffect, useMemo, useRef, useState } from 'react'
import { SKINS } from '../../lib/skins/skinsConfig'
import { useSkinStore } from '../../lib/skins/skinStore'
import { validateModelUrl } from '../../lib/skins/validateModelUrl'
import type { SkinColors } from '../../lib/skins/skinTypes'
import SkinPreviewCanvas from './SkinPreviewCanvas'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { useKeyboardStore } from '../../lib/useKeyboardStore'

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

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function getNeighborUrls(index: number) {
  const n = SKINS.length
  if (n <= 1) return []
  const prev = SKINS[(index - 1 + n) % n]
  const next = SKINS[(index + 1) % n]
  const urls = [prev.assets.modelUrl, next.assets.modelUrl]
  prev.assets.lodModelUrls?.forEach((u) => urls.push(u))
  next.assets.lodModelUrls?.forEach((u) => urls.push(u))
  return Array.from(new Set(urls))
}

export default function SkinsModal() {
  const isConnected = useMultiplayerStore((s) => s.isConnected)
  const lobbyVisible = useMultiplayerStore((s) => s.lobbyVisible)
  const { chatActive } = useKeyboardStore()

  const {
    isModalOpen,
    selectedSkinIndex,
    colorsBySkinId,
    loadBySkinId,
    isTransitioning,
    closeModal,
    toggleModal,
    setSelectedSkinIndex,
    setSkinColors,
    setActiveSkinId,
    setSkinLoaded,
    setSkinError,
    startTransition,
    endTransition,
  } = useSkinStore()

  const skin = SKINS[selectedSkinIndex] ?? SKINS[0]
  const colors = colorsBySkinId[skin.id]
  const neighborUrls = useMemo(() => getNeighborUrls(selectedSkinIndex), [selectedSkinIndex])
  const panelRef = useRef<HTMLDivElement | null>(null)
  const playroomRef = useRef<any>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [fadePhase, setFadePhase] = useState<'in' | 'out'>('in')
  const loadedLogged = useRef<Record<string, boolean>>({})
  const isVisible = isConnected && isModalOpen

  useEffect(() => {
    import('playroomkit').then((mod: any) => {
      playroomRef.current = mod
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as any
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing || chatActive || lobbyVisible) return
      if (e.key.toLowerCase() === 'c') toggleModal()
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleModal, closeModal, chatActive, lobbyVisible])

  useEffect(() => {
    if (!isVisible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
    }
  }, [isVisible])

  useEffect(() => {
    if (!isVisible) return
    const pk = playroomRef.current
    const me = pk?.myPlayer?.()
    const profile = me?.getState?.('pdata')
    const profSkinId = profile?.skinId
    const idx = SKINS.findIndex((s) => s.id === profSkinId)
    if (idx >= 0) setSelectedSkinIndex(idx)
  }, [isVisible, setSelectedSkinIndex])

  async function applyProfile(nextSkinIndex: number, nextColors: SkinColors | undefined) {
    const pk = playroomRef.current
    const me = pk?.myPlayer?.()
    if (!me) return
    const prev = me.getState('pdata') || {}
    const nextSkin = SKINS[nextSkinIndex] ?? SKINS[0]
    const color = nextColors?.primary ?? prev.color ?? '#4a9eff'
    me.setState(
      'pdata',
      {
        ...prev,
        skinId: nextSkin.id,
        colors: nextColors ?? prev.colors,
        color,
      },
      true
    )
    // Also update local UI skin state so HUD reflects correct labels
    setActiveSkinId(nextSkin.id)
    const { localPlayerId, updateRemotePlayer } = useMultiplayerStore.getState()
    if (localPlayerId) {
      updateRemotePlayer(localPlayerId, {
        skinId: nextSkin.id,
        colors: nextColors ?? prev.colors,
        color,
      })
    }
  }

  async function validateSkinAssets(nextIndex: number) {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const nextSkin = SKINS[nextIndex] ?? SKINS[0]
    const urls = [nextSkin.assets.modelUrl, ...(nextSkin.assets.lodModelUrls ?? [])]
    if (process.env.NODE_ENV !== 'production') {
      // console.info('[Skins] Validating assets:', nextSkin.id, urls)
    }
    for (const url of urls) {
      const res = await validateModelUrl(url, ac.signal).catch(() => ({ ok: false as const, reason: 'Validation failed' }))
      if (!res.ok) return { ok: false as const, reason: `${nextSkin.label}: ${res.reason}` }
    }
    return { ok: true as const }
  }

  async function changeIndex(nextIndex: number) {
    if (!isModalOpen) return
    const token = startTransition()
    setFadePhase('out')
    await delay(300)
    if (useSkinStore.getState().transitionToken !== token) return
    const validation = await validateSkinAssets(nextIndex)
    if (useSkinStore.getState().transitionToken !== token) return
    if (!validation.ok) {
      // console.error(`Skin validation failed for ${SKINS[nextIndex]?.id ?? 'unknown'}: ${validation.reason}`);
      setSkinError(SKINS[nextIndex]?.id ?? 'unknown', validation.reason)
      setFadePhase('in')
      endTransition(token)
      return
    }
    setSkinError(SKINS[nextIndex]?.id ?? 'unknown', undefined)
    setSelectedSkinIndex(nextIndex)
    await applyProfile(nextIndex, colorsBySkinId[SKINS[nextIndex]?.id ?? ''])
    if (useSkinStore.getState().transitionToken !== token) return
    setFadePhase('in')
    endTransition(token)
  }

  function onPrev() {
    const n = SKINS.length
    if (n <= 1) return
    const nextIndex = (selectedSkinIndex - 1 + n) % n
    void changeIndex(nextIndex)
  }

  function onNext() {
    const n = SKINS.length
    if (n <= 1) return
    const nextIndex = (selectedSkinIndex + 1) % n
    void changeIndex(nextIndex)
  }

  function updateColors(patch: SkinColors) {
    setSkinColors(skin.id, patch)
    void applyProfile(selectedSkinIndex, { ...(colorsBySkinId[skin.id] ?? {}), ...patch })
  }

  const skinLoad = loadBySkinId[skin.id]
  const showPalette = skin.paletteSupport === 'customizable'

  useEffect(() => {
    if (!isVisible) return
    if (process.env.NODE_ENV === 'production') return
    if (!skinLoad?.loaded) return
    if (loadedLogged.current[skin.id]) return
    loadedLogged.current[skin.id] = true
    // console.info('[Skins] Loaded:', skin.id)
  }, [isVisible, skin.id, skinLoad?.loaded])

  if (!isVisible) return null

  return (
    <div className="skins-modal-overlay" onClick={() => closeModal()}>
      <div
        className="skins-modal-panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Skins"
        onClick={(e) => e.stopPropagation()}
        // Matches the SettingsModal treatment — capped height + scroll so
        // the palette can grow without pushing the Close / arrows out of
        // view, and the modal feels visually consistent with the rest of
        // the new UI (same chrome, same scroll behaviour).
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        <button className="skins-modal-close" type="button" onClick={() => closeModal()}>
          Close
        </button>

        <button
          className="skins-modal-arrow skins-modal-arrow-left"
          type="button"
          onClick={onPrev}
          disabled={SKINS.length <= 1 || isTransitioning}
          aria-label="Previous skin"
        >
          ‹
        </button>
        <button
          className="skins-modal-arrow skins-modal-arrow-right"
          type="button"
          onClick={onNext}
          disabled={SKINS.length <= 1 || isTransitioning}
          aria-label="Next skin"
        >
          ›
        </button>

        <div className="skins-modal-grid">
          <div className="skins-preview-col">
            <div className={`skins-preview ${fadePhase === 'out' ? 'is-fading-out' : ''}`}>
              <SkinPreviewCanvas
                skin={skin}
                colors={colors}
                neighborUrls={neighborUrls}
                onLoaded={() => setSkinLoaded(skin.id, true)}
              />
              {!skinLoad?.loaded && (
                <div className="skins-preview-loading">
                  <div className="spinner"></div>
                </div>
              )}
            </div>
          </div>

          <div className="skins-info-col">
            {/* Header refactored to match the SettingsModal look: a big
                "Skins" title row (same font weight / casing as "Settings")
                with the current skin name + index rendered as a secondary
                description instead of stacked labels. Keeps all the
                existing data but feels like one cohesive modern modal. */}
            <div className="skins-header">
              <div className="skins-title">Skins</div>
              <div className="skins-subtitle">
                {skin.label} · {selectedSkinIndex + 1} / {SKINS.length}
              </div>
            </div>

            {loadBySkinId[skin.id]?.lastError && (
              <div className="skins-error" role="alert">
                {loadBySkinId[skin.id]?.lastError}
              </div>
            )}

            {showPalette && (
              // Uses the `settings-section` family of classes (shared with
              // the Settings modal) so the palette visually matches the
              // rest of the new UI — same green uppercase title, same
              // description styling, same section spacing — instead of
              // the legacy `.skins-palette` box look.
              <div className="settings-section">
                <div className="settings-section-title">Colors</div>
                <div className="settings-section-description">
                  Tap a swatch to recolour the selected skin. Visible to every player.
                </div>
                <div className="skin-colors-grid">
                  {SKIN_COLORS.map(({ label, hex }) => (
                    <button
                      key={hex}
                      className={`skin-color-btn ${colors?.primary === hex ? 'selected' : ''}`}
                      style={{ '--skin-color': hex } as React.CSSProperties}
                      onClick={() => updateColors({ primary: hex })}
                      title={label}
                    >
                      <div className="skin-color-swatch" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="skins-footer">
              <div className="skins-hint">N / C / Esc: close</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
