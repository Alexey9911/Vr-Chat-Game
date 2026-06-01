# 🌐 Alonverse VR Chat Game

> An open-source 3D social world built with **Next.js**, **React Three Fiber**, **Three.js**, **PlayroomKit**, real-time multiplayer, voice chat, spatial audio, custom avatars, emotes, checkpoints, optimized GLB/KTX2 assets, and experimental AI/API integrations.

This repository is intended as a learning project for developers who want to understand how a browser-based 3D multiplayer experience can be assembled end-to-end: scene loading, avatar sync, lobby flow, camera controls, collision logic, spatial music, voice chat, asset optimization, provider fallback strategies, and deploy-ready Next.js architecture.

---

## ✨ What This Project Teaches

This project is not only a game/demo. It is a practical reference for building interactive 3D web apps with real production problems:

- 🧍 Multiplayer player state synchronization
- 🏠 Loading large Blender/GLB environments in the browser
- 🎮 Third-person movement, mobile controls, pointer lock, camera orbit, and cinematic camera modes
- 🧱 Invisible collision meshes and ground validation
- 🚪 Checkpoint-based teleporting between zones
- 🎙️ WebRTC-style voice chat with distance-based volume
- 🎵 Spatial music and synchronized YouTube playback
- 🧑‍🎤 Custom skin system with preview canvases
- 💬 Multiplayer chat, emotes, GIFs, and bubbles
- ⚙️ Settings persistence with Zustand
- 🚀 GLB, Draco, Meshopt, and KTX2 optimization patterns
- 🔁 Multi-provider API fallback and API-key rotation concepts
- 📦 Next.js deployment flow for Vercel

---

## 🧠 Core Idea

The project recreates a small **VRChat-style social world** in the browser. Players enter through a lobby, choose a name/skin, join a multiplayer room, move around a 3D house/world, see other players, chat, use emotes, play music, talk through voice, and teleport between different zones such as the exterior, rooms, and balcony.

The codebase is intentionally useful for learning because most systems are separated into components, hooks, stores, and utility modules instead of being hidden inside one giant file.

---

## 🛠️ Tech Stack

### Frontend

- **Next.js 14**
- **React 18**
- **TypeScript + JavaScript**
- **Tailwind CSS**
- **Zustand** for global state
- **Jotai** for lightweight reactive state patterns

### 3D / Graphics

- **Three.js**
- **React Three Fiber**
- **@react-three/drei**
- **three-stdlib**
- **GLB / GLTF assets**
- **KTX2 texture loading**
- **Meshopt / Draco compression support**
- **HDR environments**

### Multiplayer / Realtime

- **PlayroomKit** for multiplayer room/state sync
- Playroom RPC calls for music, voice signaling, and shared actions
- Position/rotation compression and threshold-based syncing

### Media / Audio

- Spatial music system
- YouTube audio sync system
- Voice chat system
- Per-player distance attenuation
- TTS API endpoint support

### APIs / Providers

The project contains examples for:

- LLM provider fallback architecture
- Amazon product search API flow
- Flight search API flow
- Text-to-speech generation
- GIF/emote provider integration

> ⚠️ For open-source release, all API keys must be moved to environment variables before publishing.

---

## 📸 Main Features

### 🌍 3D Social World

The app renders a large 3D world with a house scene, rooms, cars, props, labels, animated characters, NPC-style elements, and decorative objects.

Key files:

```txt
components/Canvas3D.tsx
components/Scene3D.jsx
components/HouseScene.jsx
components/rooms/
components/checkpoints/
```

---

### 👥 Multiplayer Lobby System

Players enter through a lobby flow before joining the world. The lobby handles player profile data, selected skin, room/lobby state, admin tools, and background PlayroomKit connection.

Key files:

```txt
components/multiplayer/LobbyScreen.tsx
components/multiplayer/PlayersList.tsx
components/multiplayer/AdminLobbyPanel.tsx
lib/multiplayerStore.ts
lib/lobbyConfig.ts
lib/lobbyApi.ts
```

Learning topics:

- Client-only multiplayer initialization
- Dynamic imports to avoid SSR issues
- Player metadata with Playroom state
- Lobby visibility and player lifecycle
- Admin room monitoring
- Avoiding ghost players before users click Play

---

### 🧍 Avatar & Skin System

The project includes multiple avatar skins, a skin picker, preview canvas, and per-player skin synchronization.

Key files:

```txt
components/skins/SkinsModal.tsx
components/skins/SkinPreviewCanvas.tsx
lib/skins/skinsConfig.ts
lib/skins/skinStore.ts
components/multiplayer/*Avatar.tsx
components/multiplayer/RemotePlayerAvatar.jsx
```

Learning topics:

- Dynamic GLB avatars
- Skin preview rendering
- Centralized skin config
- Remote avatar rendering
- Animation state selection
- KTX2 skin loading

---

### 🎮 Movement, Camera & Controls

The movement system supports desktop and mobile input, third-person camera orbit, pointer lock, jump physics, teleporting, camera collision, and cinematic camera mode.

Key files:

```txt
hooks/useCameraControls.ts
components/KeyboardHUD.tsx
components/TouchControls.tsx
components/CinematicCamera.tsx
components/CinematicHUD.tsx
lib/camera/viewStore.ts
lib/useKeyboardStore.ts
```

Controls:

| Key / Input | Action |
|---|---|
| `W A S D` | Move / rotate |
| `Space` | Jump |
| `Enter` | Chat |
| `V` | Push-to-talk voice chat |
| `J` | Toggle first-person / third-person view |
| `F9` | Cinematic camera mode |
| `2 - 5` | Emotes |
| Touch joystick | Mobile movement |
| Touch drag | Mobile camera orbit |

---

### 🧱 Collision System

The project uses invisible collision meshes and raycasters to validate player movement, ground detection, camera obstruction, and zone boundaries.

Key files:

```txt
components/HouseExteriorCollision.jsx
components/HouseBalconyCollision.jsx
components/CarsCollision.jsx
components/rooms/RoomsObjectsCollision.tsx
lib/collisionRef.ts
hooks/useCameraControls.ts
```

Learning topics:

- Invisible physics meshes
- Raycast-based collision
- Ground snapping
- Preventing player tunneling
- Camera collision and zoom smoothing
- Separating visual meshes from collision meshes

---

### 🚪 Checkpoints & Zone Teleporting

The world contains GTA-style checkpoint transitions between exterior, interior rooms, and balcony areas. A fade overlay hides the teleport and camera projection changes.

Key files:

```txt
components/checkpoints/Checkpoint.tsx
components/checkpoints/CheckpointEntryHouse.tsx
components/checkpoints/CheckpointExitHouse.tsx
components/checkpoints/CheckpointRoomsToBalcony.tsx
components/checkpoints/CheckpointBalconyToRooms.tsx
components/checkpoints/FadeOverlay.tsx
lib/zoneStore.ts
lib/teleportController.ts
```

Learning topics:

- Zone-based gameplay state
- Teleport controller decoupling
- Fade transition masking
- Cooldowns to avoid instant bounce-back
- Dynamic camera far-plane optimization by zone

---

### 💬 Chat, Emotes & GIFs

The project includes multiplayer chat UI, emote bars, GIF picking, parsed emote tokens, chat bubbles, and local message history patterns.

Key files:

```txt
components/multiplayer/ChatInput.tsx
components/ui/EmoteBar.tsx
components/multiplayer/EmotePicker.tsx
components/multiplayer/EmotePickerNew.tsx
lib/emotes/emotesConfig.ts
hooks/useChatHistory.js
```

Learning topics:

- Chat active state vs movement controls
- Emote parsing
- GIF caching
- Message validation
- Floating player chat bubbles

---

### 🎵 Spatial Audio & YouTube Sync

Players can trigger music and synchronized YouTube playback. Audio volume changes based on distance between players.

Key files:

```txt
lib/audio/musicSystem.ts
lib/audio/spatialAudioSystem.ts
lib/audio/youtubePlayer.ts
components/ui/AudioButton.tsx
components/ui/YouTubeModal.tsx
components/multiplayer/LobbyScreen.tsx
```

Learning topics:

- Distance attenuation
- Shared music state
- YouTube playback synchronization
- Local vs remote audio instances
- Volume sliders and persisted settings

---

### 🎙️ Voice Chat

The project includes a voice chat system with push-to-talk and spatial volume behavior.

Key files:

```txt
lib/audio/voiceChatSystem.ts
components/settings/SettingsModal.tsx
components/ui/AudioButton.tsx
components/multiplayer/LobbyScreen.tsx
```

Learning topics:

- Microphone permission flow
- Push-to-talk state
- Peer audio mapping
- Distance-based mic volume
- Local mic gain and remote mic volume controls
- Playroom RPC signaling patterns

---

### ⚙️ Settings System

The settings panel manages audio, mic, environment, tone mapping, exposure, HDR intensity, background visibility, and other visual options.

Key files:

```txt
components/settings/SettingsModal.tsx
lib/settings/settingsStore.ts
components/ColorControls.tsx
```

Learning topics:

- Persisted Zustand settings
- Partial persistence
- Runtime Three.js environment changes
- Tone mapping controls
- Avoiding full scene remounts when changing HDR/environment settings

---

### 🚀 Asset Loading & Optimization

This project contains multiple patterns for making heavy 3D assets usable in a browser experience.

Key files:

```txt
components/AssetPreloader.tsx
hooks/useGLTFKtx2.ts
hooks/useKtx2Loader.ts
hooks/useOptimizedGLTF.js
hooks/useOptimizedTexture.ts
scripts/compress-glb.mjs
scripts/inspect-glb.mjs
glb_compression_and_loading.md
```

Learning topics:

- Heavy GLB preloading
- Suspense boundaries
- `useProgress()` loading gates
- Draco loader setup
- Meshopt decoder setup
- KTX2 loader singleton
- Avoiding repeated WASM transcoder compilation
- GPU texture warmup
- Loading screen thresholds
- Choosing which assets should or should not be compressed

---

## 📁 Project Structure

```txt
.
├── components/
│   ├── checkpoints/          # Zone teleports and fade transitions
│   ├── multiplayer/          # Lobby, players, avatars, chat, admin tools
│   ├── rooms/                # Interior room models and objects
│   ├── settings/             # Settings modal
│   ├── skins/                # Skin picker and preview canvas
│   ├── ui/                   # Audio, skin, emote UI
│   ├── Canvas3D.tsx          # Main R3F canvas wrapper
│   └── Scene3D.jsx           # Main 3D scene composition
│
├── hooks/
│   ├── useCameraControls.ts  # Movement, camera, collision, teleport registration
│   ├── useGLTFKtx2.ts        # KTX2 + Meshopt GLB loader
│   ├── useKtx2Loader.ts      # Shared KTX2 loader singleton
│   ├── usePositionSync.ts    # Position/rotation sync thresholding
│   └── useIsMobile.ts        # Mobile detection
│
├── lib/
│   ├── audio/                # Music, YouTube, voice, spatial audio
│   ├── camera/               # Camera constants and view store
│   ├── emotes/               # Emote config and parsing
│   ├── settings/             # Persisted user settings
│   ├── skins/                # Skin config and store
│   ├── multiplayerStore.ts   # Multiplayer global state
│   ├── teleportController.ts # Global teleport function bridge
│   └── zoneStore.ts          # Current zone and transition state
│
├── pages/
│   ├── api/                  # Example API routes and provider integrations
│   ├── _app.tsx
│   └── index.tsx             # Main page composition
│
├── public/                   # GLBs, textures, HDRs, media, icons, audio
├── scripts/                  # GLB inspection/compression utilities
├── styles/                   # Global and module CSS
├── next.config.js
├── tailwind.config.ts
└── package.json
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

The project uses several 3D and experimental packages, so `--legacy-peer-deps` is recommended for smoother installation.

### 3. Create environment variables

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Suggested `.env.example`:

```env
# LLM providers
CEREBRAS_API_KEY_1=
CEREBRAS_API_KEY_2=
GROQ_API_KEY_1=
GROQ_API_KEY_2=

# RapidAPI providers
RAPIDAPI_KEY_1=
RAPIDAPI_KEY_2=

# Text-to-speech
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=

# Optional asset mode
NEXT_PUBLIC_USE_KTX2=1
```

> 🔐 Never commit real API keys. This project should be open-source friendly, so all secrets must live in `.env.local` or your hosting provider's environment settings.

### 4. Run the development server

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

### 5. Build for production

```bash
npm run build
npm run start
```

---

## 🧪 Available Scripts

```bash
npm run dev       # Start Next.js dev server with Turbo
npm run build     # Build production app
npm run start     # Start production server
npm run lint      # Run Next linting
```

Utility scripts:

```bash
node scripts/inspect-glb.mjs public/path/to/model.glb
node scripts/compress-glb.mjs
node scripts/check-console.mjs
```

---

## 🌐 Deployment

This project is configured for Vercel.

```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "npm install --legacy-peer-deps",
  "outputDirectory": ".next"
}
```

Before deploying:

1. Move all secrets to Vercel environment variables.
2. Remove any hardcoded API keys from source files.
3. Confirm large GLB/media assets are within your hosting limits.
4. Test multiplayer behavior in a production preview URL.
5. Test microphone permissions over HTTPS.

---

## 🔐 Important Security Notes Before Open Sourcing

Before publishing this repository, review the following:

- Remove hardcoded provider keys from `pages/api/*`.
- Move all API keys into `.env.local` and hosting environment variables.
- Add `.env.local` to `.gitignore`.
- Consider rotating any keys that were previously committed.
- Avoid exposing private provider URLs, paid API credentials, or admin passwords.
- Set `private: false` in `package.json` only if you intend to publish the package itself.
- Add a real open-source license such as MIT, Apache-2.0, or GPL-3.0.

Suggested `.gitignore` additions:

```gitignore
.env
.env.local
.env.production
.env.development
*.log
.next/
node_modules/
```

---

## 🧩 Provider Architecture

The API layer demonstrates a provider fallback mindset:

```txt
Primary provider → fallback provider → response post-processing → frontend UI
```

Examples in the project include:

- LLM provider fallback
- RapidAPI key rotation
- Text-to-speech generation
- Product search API
- Flight search API with fallback data

This is useful for learning how to keep an app functional when one provider is rate-limited, unavailable, or too slow.

---

## 🧠 Performance Lessons

This project includes many real-world browser 3D performance lessons:

- Use Suspense boundaries around heavy 3D models.
- Preload only the assets that are guaranteed to be needed soon.
- Do not preload every asset blindly.
- Use compressed GLBs carefully; compression is not always a win.
- KTX2 can improve GPU upload time but may increase file size depending on mode.
- Use one shared KTX2 loader per WebGL renderer to avoid repeated WASM compilation.
- Use invisible collision meshes instead of complex visual meshes for physics checks.
- Reduce multiplayer network traffic by sending position updates only after meaningful deltas.
- Hide expensive transitions behind loading screens or fade overlays.
- Adjust camera `far` by zone to reduce unnecessary rendering.

---

## 🗺️ Roadmap Ideas

Potential improvements for contributors:

- [ ] Move all providers to environment variables
- [ ] Add `.env.example`
- [ ] Add a proper license
- [ ] Add screenshots and demo video
- [ ] Add PlayroomKit setup documentation
- [ ] Add contribution guide
- [ ] Add automated type/lint checks
- [ ] Improve mobile UI polish
- [ ] Add more rooms and portals
- [ ] Add configurable maps
- [ ] Add avatar upload support
- [ ] Add server-side moderation tools
- [ ] Add better admin authentication
- [ ] Add analytics for player count and performance
- [ ] Add asset build pipeline documentation

---

## 🤝 Contributing

Contributions are welcome. This project is designed to be a learning resource for developers exploring multiplayer 3D apps on the web.

Good first contributions:

- Improve documentation
- Add screenshots
- Clean up environment variable usage
- Add new skins
- Add new emotes
- Improve mobile controls
- Optimize GLB assets
- Refactor one system into smaller modules
- Add comments explaining difficult Three.js/R3F logic

Please keep contributions educational and easy to understand.

---

## 📚 Recommended Learning Path

If you are studying this codebase, a good order is:

1. Start with `pages/index.tsx` to understand the app composition.
2. Read `components/Canvas3D.tsx` to understand how the 3D scene is mounted.
3. Read `components/Scene3D.jsx` to understand what objects are placed in the world.
4. Read `hooks/useCameraControls.ts` to understand player movement and collision.
5. Read `components/multiplayer/LobbyScreen.tsx` to understand PlayroomKit integration.
6. Read `lib/multiplayerStore.ts` to understand global multiplayer state.
7. Read `lib/audio/*` to understand spatial audio and voice systems.
8. Read `components/checkpoints/*` to understand teleporting between zones.
9. Read `glb_compression_and_loading.md` to understand asset optimization decisions.

---

## ⚠️ Disclaimer

This is an experimental open-source learning project. Some systems are prototypes, some APIs may require paid or rate-limited provider accounts, and some assets may need replacement depending on licensing and distribution rights.

Before using it in production, review security, asset rights, provider costs, performance, moderation, and privacy requirements.

---

## 📄 License

Choose a license before publishing.

Suggested option:

```txt
MIT License
```

If you want maximum learning and reuse, MIT is a simple and permissive choice.

---

## 🙌 Credits

Built as an experimental 3D multiplayer web project to help developers learn how modern browser-based social worlds can be created with Next.js, React Three Fiber, Three.js, PlayroomKit, realtime state sync, optimized 3D assets, spatial audio, and API provider integrations.
