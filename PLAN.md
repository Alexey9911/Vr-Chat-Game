# AlonHouse — VR Chat with Mansion Environment

## Overview
Multiplayer 3D VR chat built with Next.js 14, React Three Fiber, and PlayroomKit. Identical features to the original $AlonVerse project but with a custom mansion environment (house with garden, cars, two floors).

---

## Current State (Phase 1 — Base)
- [x] Full multiplayer system (PlayroomKit)
- [x] Lobby system with multi-room support (ALONVERSE-1..N)
- [x] 3 Skins: Alon, Trump, ElonMuskChibi
- [x] Emotes system (Punch, Yes, Wave, Death) + GIF emotes in chat
- [x] Live text chat with emote/GIF support
- [x] Voice chat (push-to-talk V key, WebRTC P2P, spatial audio)
- [x] YouTube music player (paste link, synced across players)
- [x] Skin-specific music (each skin has its own song)
- [x] Admin system (kick players, lobby management)
- [x] Settings (environment preset, volume, mic controls)
- [x] First-person + third-person camera (J to toggle)
- [x] WASD movement + Space jump + mobile touch controls
- [x] Simple floor plane (placeholder)

## Phase 2 — Mansion Environment (Pending Blender Model)
- [ ] Import house GLB from Blender (first floor + second floor)
- [ ] Collision boundaries for walls/doors
- [ ] Garden exterior with walkable area
- [ ] Parked cars (decorative)
- [ ] Second floor access:
  - Option A: Teleport circles (step into glowing circle → teleport up)
  - Option B: Staircase with ramp collider
- [ ] Interior furniture/decorations

## Phase 3 — Polish
- [ ] Custom lighting per room
- [ ] Door interactions (open/close)
- [ ] Window views
- [ ] Ambient sounds per area
- [ ] Mini-map or room labels

---

## Tech Stack
- **Framework:** Next.js 14 (Pages Router)
- **3D:** React Three Fiber + Drei
- **Multiplayer:** PlayroomKit (rooms, RPC, state sync)
- **State:** Zustand
- **Voice:** WebRTC (custom P2P implementation)
- **Audio:** Web Audio API + YouTube IFrame API
- **Styling:** Tailwind CSS + CSS Modules
- **Language:** TypeScript + JSX mix

## Key Directories
```
components/
  multiplayer/    — LobbyScreen, ChatInput, PlayersList, Avatars, Admin panels
  skins/          — SkinsModal, SkinPreviewCanvas
  settings/       — SettingsModal
  ui/             — AudioButton, EmoteBar, SkinBar, YouTubeModal
  Scene3D.jsx     — Main 3D scene (floor + remote players)
  Canvas3D.tsx    — R3F Canvas wrapper with camera + environment

lib/
  audio/          — musicSystem, voiceChatSystem, youtubePlayer, spatialAudioSystem
  skins/          — skinsConfig, skinStore, skinTypes
  emotes/         — emotesConfig
  camera/         — cameraConstants, viewStore
  settings/       — settingsStore
  auth/           — adminAuth
  multiplayerStore.ts, lobbyConfig.ts, lobbyApi.ts

hooks/
  useCameraControls.ts, usePositionSync.ts, useIsMobile.ts, etc.

public/
  alonskin-v1.glb, trumpskin-v1.glb, elonmuskchibi-v1.glb
  sounds/, emotes/, floor/, fonts/, icons/, sky.hdr
```

## Controls
- **WASD** — Move/rotate
- **Space** — Jump
- **Enter** — Open chat
- **V** (hold) — Push-to-talk
- **J** — Toggle first/third person
- **2-5** — Emotes
- **F9** — Cinematic orbit camera
