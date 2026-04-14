/**
 * Multi-Lobby Configuration
 * Defines lobby settings and utilities for the multi-room system
 * Supports infinite lobbies: ALONVERSE-1, ALONVERSE-2, ... ALONVERSE-N
 */

export const LOBBY_PREFIX = 'ALONVERSE'
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
  const match = code.match(/ALONVERSE-(\d+)/)
  return match ? parseInt(match[1], 10) : 1
}

/**
 * Generate an array of lobby codes from 1 to count
 */
export function getLobbyCodesUpTo(count: number): LobbyCode[] {
  return Array.from({ length: count }, (_, i) => generateLobbyCode(i + 1))
}

/**
 * Check if a lobby code is valid (matches ALONVERSE-N pattern)
 */
export function isValidLobbyCode(code: string): code is LobbyCode {
  return /^ALONVERSE-\d+$/.test(code)
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
