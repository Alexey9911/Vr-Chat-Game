import React, { useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { useSettingsStore, type ToneMappingKey } from '../lib/settings/settingsStore'

// Map ToneMappingKey (user-facing label in the settings modal) → the
// corresponding THREE.*ToneMapping constant. Neutral + AgX exist at
// runtime in three@0.177 but the bundled @types are older → cast THREE
// to `any` for those two so TypeScript stays happy without forcing a
// types upgrade.
const T: any = THREE
export const TONEMAPS: Record<ToneMappingKey, number> = {
  'ACES Filmic': THREE.ACESFilmicToneMapping,
  'Neutral (Khronos)': T.NeutralToneMapping ?? THREE.ACESFilmicToneMapping,
  'AgX': T.AgXToneMapping ?? THREE.ACESFilmicToneMapping,
  'Cineon': THREE.CineonToneMapping,
  'Reinhard': THREE.ReinhardToneMapping,
  'Linear': THREE.LinearToneMapping,
  'None': THREE.NoToneMapping,
}

/**
 * Applies the user's video / colour settings to the live renderer. Mount
 * INSIDE the <Canvas> (needs useThree). Also owns the <Environment>
 * component so its `environmentIntensity` / `backgroundIntensity` can be
 * tweaked without a re-mount. Changing the tonemap at runtime requires
 * traversing every material and flagging `needsUpdate = true` so the
 * shader recompiles with the new tone-map chunk (otherwise the switch
 * only takes effect on next full reload).
 */
export default function ColorControls() {
  const { gl, scene } = useThree()
  const envSetting = useSettingsStore((s) => s.environment)
  const toneMapping = useSettingsStore((s) => s.toneMapping)
  const toneMappingExposure = useSettingsStore((s) => s.toneMappingExposure)
  const envIntensity = useSettingsStore((s) => s.envIntensity)
  const bgIntensity = useSettingsStore((s) => s.bgIntensity)
  const showBackground = useSettingsStore((s) => s.showBackground)

  useEffect(() => {
    const mode = TONEMAPS[toneMapping] ?? THREE.ACESFilmicToneMapping
    gl.toneMapping = mode as any
    gl.toneMappingExposure = toneMappingExposure
    scene.traverse((obj: any) => {
      if (!obj.isMesh) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m: any) => {
        if (m && 'needsUpdate' in m) m.needsUpdate = true
      })
    })
  }, [toneMapping, toneMappingExposure, gl, scene])

  // Pick the actual HDRI / preset to use based on user settings store.
  // Matches the logic previously inlined in Canvas3D.
  const envProps = (() => {
    if (envSetting === 'sunset') return { files: 'sky.hdr' as any }
    if (envSetting === 'night') return { preset: 'night' as const }
    if (envSetting === 'warehouse') return { preset: 'warehouse' as const }
    return { preset: 'sunset' as const }
  })()

  return (
    <Environment
      {...envProps}
      background={showBackground}
      environmentIntensity={envIntensity}
      backgroundIntensity={bgIntensity}
    />
  )
}
