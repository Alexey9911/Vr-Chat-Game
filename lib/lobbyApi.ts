/**
 * Lobby Registry API Client
 * Communicates with the Deno KV lobby API to find available rooms
 * 
 * Change LOBBY_API_URL when deploying to Deno Deploy
 */

const LOBBY_API_URL = 'https://elon-backend-lobby-api.alexey9911.deno.net'

export interface LobbyResponse {
  code: string
  players: number
  max: number
}

export interface ChatMessage {
  id: string
  playerId: string
  playerName: string
  playerColor?: string
  text: string
  timestamp: number
}

export interface LobbyStatus {
  lobbies: Array<{ code: string; players: number; max: number }>
}

/** Find the best lobby to join (first with space) */
export async function findLobby(): Promise<LobbyResponse> {
  const res = await fetch(`${LOBBY_API_URL}/lobby`)
  if (!res.ok) throw new Error('Failed to find lobby')
  return res.json()
}

/** Register player in a lobby (increment count) */
export async function joinLobby(playerId: string, lobby: string): Promise<LobbyResponse> {
  const res = await fetch(`${LOBBY_API_URL}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, lobby }),
  })
  if (!res.ok) throw new Error('Failed to join lobby')
  return res.json()
}

/** Unregister player from lobby (decrement count) */
export function leaveLobby(playerId: string): void {
  try {
    const data = JSON.stringify({ playerId })
    const url = `${LOBBY_API_URL}/leave`

    // sendBeacon with text/plain — avoids CORS preflight (application/json triggers it!)
    // text/plain is a "simple" content type so no preflight needed
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon(url, new Blob([data], { type: 'text/plain' }))
      if (sent) return
    }

    // Fallback: fetch with keepalive
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data,
      keepalive: true,
    }).catch(() => {})
  } catch (_) {
    // Best effort
  }
}

/** Get all lobby statuses (for admin panel) */
export async function getLobbyStatus(): Promise<LobbyStatus> {
  const res = await fetch(`${LOBBY_API_URL}/status`)
  if (!res.ok) throw new Error('Failed to get status')
  return res.json()
}

/** Add fake players to a lobby (admin testing) */
export async function fakeJoin(lobby: string, count: number): Promise<LobbyResponse> {
  const res = await fetch(`${LOBBY_API_URL}/fake-join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lobby, count }),
  })
  if (!res.ok) throw new Error('Failed to add fake players')
  return res.json()
}

/** Remove fake players from a lobby (admin testing) */
export async function fakeLeave(lobby: string, count: number): Promise<LobbyResponse> {
  const res = await fetch(`${LOBBY_API_URL}/fake-leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lobby, count }),
  })
  if (!res.ok) throw new Error('Failed to remove fake players')
  return res.json()
}

/** Reset all lobby data (admin only) */
export async function resetLobbies(): Promise<void> {
  await fetch(`${LOBBY_API_URL}/reset`, { method: 'POST' })
}

/** Get the latest chat messages for a lobby. Neon-backed (/api/messages); falls back to the legacy Deno KV if
 *  that route errors (e.g. DATABASE_URL not yet set in this deployment) so chat history never breaks mid-migration. */
export async function getChatHistory(lobby: string): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`/api/messages?lobby=${encodeURIComponent(lobby)}`)
    if (res.ok) return res.json()
  } catch (_) {
    /* fall through to the legacy backend */
  }
  try {
    const res = await fetch(`${LOBBY_API_URL}/chat?lobby=${lobby}`)
    if (!res.ok) return []
    return res.json()
  } catch (_) {
    return []
  }
}

/** Push a new chat message to the lobby's history. Persists to Neon (/api/messages); falls back to the legacy
 *  Deno KV on error. Fire-and-forget. */
export async function sendChatMessage(lobby: string, message: ChatMessage): Promise<void> {
  try {
    const res = await fetch(`/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lobby, message }),
    })
    if (res.ok) return
  } catch (_) {
    /* fall through to the legacy backend */
  }
  try {
    await fetch(`${LOBBY_API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lobby, message }),
    })
  } catch (_) {
    // Fire and forget
  }
}

/** Get the API URL (for debugging) */
export function getApiUrl(): string {
  return LOBBY_API_URL
}
