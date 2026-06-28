import React from 'react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { kick as netKick } from '../../lib/net/netClient'

// Broadcast an adminKick over geckos: a reliable `evt {t:'kick'}` (the target leaves+reloads, others drop locally).
function broadcastKick(playerId: string) {
  netKick(playerId)
}

export default function AdminLobbyPanel() {
  const {
    adminPanelVisible,
    setAdminPanelVisible,
    currentLobby,
    remotePlayers,
    removeRemotePlayer,
  } = useMultiplayerStore()

  const playersInLobby = Array.from(remotePlayers.values())
  const playerCount = playersInLobby.length + 1 // +1 for local player

  const handleClose = () => {
    setAdminPanelVisible(false)
  }

  if (!adminPanelVisible) return null

  return (
    <div className="admin-panel-overlay" onClick={handleClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-panel-header">
          <h2>🔧 Admin Control Panel</h2>
          <button className="admin-panel-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="admin-panel-content">
          {/* Current Room Info */}
          <p className="admin-panel-subtitle">Current Room</p>

          <div className="admin-lobby-item active" style={{ marginBottom: '12px' }}>
            <div className="admin-lobby-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="admin-lobby-code">{currentLobby || 'Not connected'}</span>
                <span className="admin-lobby-players" style={{
                  background: 'rgba(0, 255, 0, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#00ff87',
                  border: '1px solid rgba(0, 255, 0, 0.3)',
                }}>
                  👥 {playerCount}
                </span>
              </div>
              <span className="admin-lobby-status">● Connected</span>
            </div>

            {/* Player list */}
            {playersInLobby.length > 0 && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                background: 'rgba(0, 255, 135, 0.05)',
                borderRadius: '6px',
                border: '1px solid rgba(0, 255, 135, 0.15)',
              }}>
                <div style={{
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginBottom: '4px',
                  fontWeight: '600',
                }}>Players in room:</div>
                {playersInLobby.map((player) => (
                  <div key={player.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: player.isAdmin ? '#ffd700' : '#ffffff',
                    padding: '3px 0',
                    fontWeight: player.isAdmin ? '700' : '500',
                  }}>
                    <span>{player.isAdmin ? '👑 ' : '• '}{player.name || 'Unknown'}</span>
                    <button
                      onClick={() => {
                        broadcastKick(player.id)
                        removeRemotePlayer(player.id)
                      }}
                      style={{
                        background: 'rgba(255, 60, 60, 0.2)',
                        border: '1px solid rgba(255, 60, 60, 0.4)',
                        borderRadius: '4px',
                        color: '#ff4a4a',
                        fontSize: '9px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        cursor: 'pointer',
                        lineHeight: '1',
                      }}
                    >
                      KICK
                    </button>
                  </div>
                ))}
                <div style={{
                  fontSize: '11px',
                  color: '#00ff87',
                  padding: '2px 0',
                  fontWeight: '700',
                }}>
                  👑 {sessionStorage.getItem('adminNickname') || 'You'} (You)
                </div>
                {/* Kick All button */}
                <button
                  onClick={() => {
                    if (!confirm(`Kick ALL ${playersInLobby.length} players from this room?`)) return
                    playersInLobby.forEach(p => {
                      broadcastKick(p.id)
                      removeRemotePlayer(p.id)
                    })
                  }}
                  style={{
                    marginTop: '6px',
                    width: '100%',
                    padding: '5px',
                    background: 'rgba(255, 60, 60, 0.15)',
                    border: '1px solid rgba(255, 60, 60, 0.3)',
                    borderRadius: '6px',
                    color: '#ff4a4a',
                    fontSize: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  🗑 Kick All Players
                </button>
              </div>
            )}
          </div>

          <div className="admin-panel-info">
            <p>🎮 <strong>Hotkey:</strong> Press <kbd>Ctrl+A</kbd> to toggle this panel</p>
          </div>
        </div>
      </div>
    </div>
  )
}
