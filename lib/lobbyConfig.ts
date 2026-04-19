/**
 * Multi-Lobby Configuration
 * Defines lobby settings and utilities for the multi-room system
 * Supports infinite lobbies: alonverse-1, alonverse-2, ... alonverse-N
 *
 * NOTE: Prefix MUST match the backend (`lobby-api/main.ts :: LOBBY_PREFIX`).
 * If they diverge, `findLobby()` returns e.g. `alonverse-1` but
 * `getLobbyIndex()` can't parse it and always falls back to 1 — which is
 * exactly the "when lobby 1 fills up everyone gets redirected to a weird
 * URL / reload loop" bug.
 */

export const LOBBY_PREFIX = 'alonverse'
export const MAX_PLAYERS_PER_LOBBY = 10

// Dynamic lobby code type (no fixed limit)
export type LobbyCode = string

export interface LobbyInfo {
  code: LobbyCode
  playerCount: number
  maxPlayers: number
  isActive: boolean
  isFull: boolean
}

/**
 * Generate a lobby code from an index (1-based)
 */
export function generateLobbyCode(index: number): LobbyCode {
  return `${LOBBY_PREFIX}-${index}`
}

/**
 * Parse the lobby index from a lobby code
 * Returns 1 if the code is invalid
 */
export function getLobbyIndex(code: string): number {
  // Case-insensitive so legacy codes (AlonHouse-N, alonverse-N, ALONVERSE-N)
  // all parse correctly during the transition.
  const match = code.match(/(?:alonverse|alonhouse)-(\d+)/i)
  return match ? parseInt(match[1], 10) : 1
}

/**
 * Generate an array of lobby codes from 1 to count
 */
export function getLobbyCodesUpTo(count: number): LobbyCode[] {
  return Array.from({ length: count }, (_, i) => generateLobbyCode(i + 1))
}

/**
 * Check if a lobby code is valid (matches alonverse-N pattern)
 * Accepts legacy `AlonHouse-N` codes too so existing bookmarks still work.
 */
export function isValidLobbyCode(code: string): code is LobbyCode {
  return /^(?:alonverse|alonhouse)-\d+$/i.test(code)
}

/**
 * Get the next lobby code after the given one
 */
export function getNextLobbyCode(currentCode: LobbyCode): LobbyCode {
  const currentIndex = getLobbyIndex(currentCode)
  return generateLobbyCode(currentIndex + 1)
}

/**
 * Generate default lobby info structure for N lobbies
 */
export function createDefaultLobbyInfo(count: number = 5): LobbyInfo[] {
  return getLobbyCodesUpTo(count).map(code => ({
    code,
    playerCount: 0,
    maxPlayers: MAX_PLAYERS_PER_LOBBY,
    isActive: false,
    isFull: false,
  }))
}

/**
 * Check if player count requires admin bypass
 */
export function requiresAdminBypass(lobby: LobbyInfo): boolean {
  return lobby.playerCount >= lobby.maxPlayers
}
