import { create } from 'zustand'
import { EYE_HEIGHT } from './camera/cameraConstants'

// Initial spawn position - must match useCameraControls.ts
const SPAWN_X = -59.95
const SPAWN_Z = -87.86
const SPAWN_ROT = (74.61 + 180) * (Math.PI / 180) // 74.61° display + 180° offset
import { LobbyInfo, LobbyCode, createDefaultLobbyInfo, getLobbyIndex } from './lobbyConfig'

export interface ChatMessage {
  id: string
  playerId: string
  playerName: string
  playerColor?: string
  text: string
  timestamp: number
}

export interface RemotePlayer {
  id: string
  name: string
  color: string
  skinId?: string
  isAdmin?: boolean
  colors?: {
    primary?: string
    secondary?: string
    accent?: string
  }
  position: { x: number; y: number; z: number }
  rotationY: number
  chatMessage: string | null
  animation?: string | null
  isMusicPlaying?: boolean
  isYouTubePlaying?: boolean
  youtubeVideoId?: string
  isMicActive?: boolean
}

interface MultiplayerState {
  // Connection
  isConnected: boolean
  setConnected: (v: boolean) => void

  // Lobby
  lobbyVisible: boolean
  setLobbyVisible: (v: boolean) => void

  // Local player
  localPlayerId: string | null
  setLocalPlayerId: (id: string) => void

  // Remote players
  remotePlayers: Map<string, RemotePlayer>
  updateRemotePlayer: (id: string, data: Partial<RemotePlayer>) => void
  removeRemotePlayer: (id: string) => void
  kickedPlayerIds: Set<string>

  // Chat
  chatMessages: ChatMessage[]
  addChatMessage: (msg: ChatMessage) => void
  setChatMessages: (msgs: ChatMessage[]) => void

  // Multi-lobby system
  currentLobby: LobbyCode | null
  setCurrentLobby: (code: LobbyCode) => void
  availableLobbies: LobbyInfo[]
  updateLobbyList: (lobbies: LobbyInfo[]) => void

  // Admin system
  isAdmin: boolean
  setIsAdmin: (v: boolean) => void
  adminPanelVisible: boolean
  toggleAdminPanel: () => void
  setAdminPanelVisible: (v: boolean) => void
}

export const useMultiplayerStore = create<MultiplayerState>((set, get) => ({
  isConnected: false,
  setConnected: (v) => set({ isConnected: v }),

  lobbyVisible: true,
  setLobbyVisible: (v) => set({ lobbyVisible: v }),

  localPlayerId: null,
  setLocalPlayerId: (id) => set({ localPlayerId: id }),

  remotePlayers: new Map(),
  kickedPlayerIds: new Set(),
  updateRemotePlayer: (id, data) => {
    // Skip kicked players — prevents polling from re-adding them
    if (get().kickedPlayerIds.has(id)) return
    const current = get().remotePlayers
    const existing = current.get(id) || {
      id,
      name: '',
      color: '#ffffff',
      skinId: 'alon',
      isAdmin: false,
      colors: { primary: '#4a9eff' },
      position: { x: SPAWN_X, y: EYE_HEIGHT, z: SPAWN_Z },
      rotationY: SPAWN_ROT,
      chatMessage: null,
      animation: null,
    }
    const updated = { ...existing, ...data }
    // Shallow equality check — skip if nothing actually changed
    const prev = current.get(id)
    if (prev) {
      let changed = false
      for (const key of Object.keys(data)) {
        if ((prev as any)[key] !== (updated as any)[key]) {
          changed = true
          break
        }
      }
      if (!changed) return
    }
    // Mutate the existing Map in-place (Zustand uses reference equality)
    current.set(id, updated)
    set({ remotePlayers: new Map(current) }) // New ref only when changed
  },
  removeRemotePlayer: (id) => {
    const current = new Map(get().remotePlayers)
    current.delete(id)
    const kicked = new Set(get().kickedPlayerIds)
    kicked.add(id)
    set({ remotePlayers: current, kickedPlayerIds: kicked })
  },

  chatMessages: [],
  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [...s.chatMessages.slice(-49), msg],
    })),
  setChatMessages: (msgs) => set({ chatMessages: msgs }),

  // Multi-lobby
  currentLobby: null,
  setCurrentLobby: (code) => set({ currentLobby: code }),
  availableLobbies: createDefaultLobbyInfo(),
  updateLobbyList: (lobbies) => set({ availableLobbies: lobbies }),

  // Admin
  isAdmin: false,
  setIsAdmin: (v) => set({ isAdmin: v }),
  adminPanelVisible: false,
  toggleAdminPanel: () => set((s) => ({ adminPanelVisible: !s.adminPanelVisible })),
  setAdminPanelVisible: (v) => set({ adminPanelVisible: v }),
}))
