// =============================================================================
// SINGLE SOURCE OF TRUTH for per-skin animation clips.
//
// Why this file exists: historically the emote/animation wiring was duplicated
// across hooks/useCameraControls.ts (key → clip), components/ui/EmoteBar.tsx
// (which number buttons to show) and each *Avatar.tsx (Idle/Run/Sprint map).
// They drifted out of sync and the system *assumed every skin had the same set
// of emotes*. Some skins don't (the animal skins below only have ONE clip).
// Everything now derives from this map.
//
// Fields:
//   idle  — clip played when standing still       (standard state "Idle")
//   walk  — clip played on normal WASD movement    (standard state "Run")
//   run   — clip played while sprinting (Shift)     (standard state "Sprint")
//   emotes[] — RAW clip names triggered by number keys 2..N. [] → no emotes.
//
// NOTE on clip names: the GLB export pipeline used to scramble clip names (a
// clip literally named "Walking" could visually be an idle). The CURRENT skins
// (alon/tobaku/unc) were mapped BY HAND against the visual, so their names look
// unrelated on purpose — do not "fix" them. The NEW skins (ansem/giga/fwog/
// bull/popcat) were exported after the bug was fixed, so their names match what
// they visually do (Idle_* = idle, Walking = walk, Running = run).
//
// ANIMAL SKINS (popcat = a cat, bull = a bull): the GLB ships a SINGLE clip
// ("Armature|Unreal Take|baselayer"). They have no run clip and no emotes, so
// idle/walk/run all point at that one clip and emotes is empty. Sprint (Shift)
// still boosts movement SPEED — that is handled globally in useCameraControls —
// but the animation stays the same because there is nothing else to play.
// =============================================================================

export type SkinAnimationConfig = {
  idle: string
  walk: string
  run: string
  emotes: string[]
  // Optional clip played while airborne (jump). Skins without one keep their
  // walk/run/idle clip mid-jump (the original behaviour).
  jump?: string
  // Animal skins (popcat/bull) ship only ONE clip (a walk) and have no real
  // idle. When true, the avatar STOPS animating while standing still (holds a
  // static rest pose) instead of walking in place, and only plays the clip
  // while actually moving.
  freezeWhenIdle?: boolean
}

const ANIMAL_BASE_CLIP = 'Armature|Unreal Take|baselayer'

export const SKIN_ANIMATIONS: Record<string, SkinAnimationConfig> = {
  // ── NEW SKINS (clip names match visuals) ────────────────────────────────
  // Ansem "BULL" — rebuilt from the SWAT reference via Meshy. Clip names are
  // clean (merged + renamed in scripts/build_bull_skin.mjs); has a real jump
  // clip and 3 dance emotes. Rifle is baked into the GLB (rides the spine bone).
  ansem: {
    idle: 'Idle',
    walk: 'Walking',
    run: 'Running',
    jump: 'Jump',
    emotes: ['Dance_HipHop', 'Dance_Gangnam', 'Dance_Breakdance'],
  },
  giga: {
    idle: 'Idle_11',
    walk: 'Walking',
    run: 'Running',
    emotes: ['Agree_Gesture', 'Breakdance_1990', 'FunnyDancing_01', 'Leap_of_Faith'],
  },
  fwog: {
    idle: 'Idle_4',
    walk: 'Walking',
    run: 'Running',
    emotes: ['Block6', 'Breakdance_1990', 'Hip_Hop_Dance_2'],
  },

  // ── ANIMAL SKINS (one clip, no run, no emotes) ──────────────────────────
  bull: {
    idle: ANIMAL_BASE_CLIP,
    walk: ANIMAL_BASE_CLIP,
    run: ANIMAL_BASE_CLIP,
    emotes: [],
    freezeWhenIdle: true,
  },
  popcat: {
    idle: ANIMAL_BASE_CLIP,
    walk: ANIMAL_BASE_CLIP,
    run: ANIMAL_BASE_CLIP,
    emotes: [],
    freezeWhenIdle: true,
  },

  // ── EXISTING SKINS (names hand-mapped against the old scrambled export) ──
  alon: {
    idle: 'Breakdance_1990',
    walk: 'Hip_Hop_Dance_3',
    run: 'Fall1',
    emotes: ['Boom_Dance', 'Idle_3', 'Running', 'Walking'],
  },
  tobaku: {
    idle: 'Breakdance_1990',
    walk: 'Fall1',
    run: 'Burpee_Exercise',
    emotes: ['Hip_Hop_Dance_3', 'Idle_6', 'Running', 'Walking', 'ymca_dance'],
  },
  unc: {
    idle: 'Denim_Pop_Dance',
    walk: 'FunnyDancing_01',
    run: 'Fall1',
    emotes: ['Breakdance_1990', 'Climb_Attempt_and_Fall_1', 'Idle_4', 'Running', 'Walking'],
  },
}

export function getSkinAnimation(skinId: string | null | undefined): SkinAnimationConfig | undefined {
  if (!skinId) return undefined
  return SKIN_ANIMATIONS[skinId]
}

// Standard movement-state → real clip name map for an avatar component.
// Returns {} for unknown skins so the avatar can fall back to raw clip names.
export function getSkinMovementMap(skinId: string | null | undefined): Record<string, string> {
  const cfg = getSkinAnimation(skinId)
  if (!cfg) return {}
  return { Idle: cfg.idle, Run: cfg.walk, Sprint: cfg.run, ...(cfg.jump ? { Jump: cfg.jump } : {}) }
}

// Number keys (starting at 2) that should be active/visible for this skin's
// emotes. Empty array → skin has no emotes, so NO dance buttons are shown.
export function getSkinEmoteKeys(skinId: string | null | undefined): number[] {
  const cfg = getSkinAnimation(skinId)
  if (!cfg) return []
  return cfg.emotes.map((_, i) => i + 2)
}

// number-key (as string) → raw emote clip name. {} → no emotes.
export function getSkinEmoteClipMap(skinId: string | null | undefined): Record<string, string> {
  const cfg = getSkinAnimation(skinId)
  const map: Record<string, string> = {}
  if (!cfg) return map
  cfg.emotes.forEach((clip, i) => {
    map[String(i + 2)] = clip
  })
  return map
}
