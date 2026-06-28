/**
 * Chat API Client
 * Persists and retrieves chat messages via the Neon-backed /api/messages route.
 */

export interface ChatMessage {
  id: string
  playerId: string
  playerName: string
  playerColor?: string
  text: string
  timestamp: number
}

/** Get the latest chat messages for a lobby. Neon-backed (/api/messages). */
export async function getChatHistory(lobby: string): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`/api/messages?lobby=${encodeURIComponent(lobby)}`)
    if (res.ok) return res.json()
  } catch (_) {
    /* best effort */
  }
  return []
}

/** Push a new chat message to the lobby's history. Persists to Neon (/api/messages). Fire-and-forget. */
export async function sendChatMessage(lobby: string, message: ChatMessage): Promise<void> {
  try {
    await fetch(`/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lobby, message }),
    })
  } catch (_) {
    // Fire and forget
  }
}
