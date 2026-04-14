import React from 'react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'

// Players list HUD — identical logic to playroom_guide/Leaderboard.jsx
// Shows online players with their profile colors and names

export default function PlayersList() {
  const { remotePlayers, isConnected, localPlayerId } = useMultiplayerStore()

  if (!isConnected) return null

  const playersArray = Array.from(remotePlayers.values())
  if (playersArray.length === 0) return null

  return (
    <div className="players-list">
      <div className="players-list-header">
        <span className="players-online-dot" />
        {playersArray.length} online
      </div>
      <div className="players-list-items">
        {playersArray.map((player) => (
          <div
            key={player.id}
            className={`players-list-item ${player.id === localPlayerId ? 'is-you' : ''}`}
          >
            <div
              className="players-list-avatar"
              style={{ backgroundColor: player.color || '#4a9eff' }}
            />
            <span className="players-list-name">
              {player.name || 'Player'}
              {player.id === localPlayerId && ' (You)'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
