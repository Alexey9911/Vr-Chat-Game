import React, { useState, useEffect } from 'react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { MAX_PLAYERS_PER_LOBBY, generateLobbyCode, getLobbyIndex } from '../../lib/lobbyConfig'
import { getLobbyStatus, resetLobbies, fakeJoin, fakeLeave } from '../../lib/lobbyApi'

export default function AdminLobbyPanel() {
  const { 
    adminPanelVisible, 
    setAdminPanelVisible, 
    currentLobby,
    remotePlayers,
    localPlayerId,
    removeRemotePlayer,
  } = useMultiplayerStore()
  const [switching, setSwitching] = useState(false)
  const [visibleCount, setVisibleCount] = useState(5)
  const [lobbyStats, setLobbyStats] = useState<Record<string, number>>({})
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const playersInLobby = Array.from(remotePlayers.values())
  const playerCount = playersInLobby.length + 1 // +1 for local player

  // Current lobby index
  const currentIndex = currentLobby ? getLobbyIndex(currentLobby) : 1
  // Show enough lobbies to always include current + extras
  const lobbyCount = Math.max(visibleCount, currentIndex + 2)
  const lobbyCodes = Array.from({ length: lobbyCount }, (_, i) => generateLobbyCode(i + 1))

  // Poll API for real player counts every 5 seconds (always active)
  const refreshStats = () => {
    setRefreshing(true)
    getLobbyStatus()
      .then(({ lobbies }) => {
        const stats: Record<string, number> = {}
        for (const l of lobbies) stats[l.code] = l.players
        setLobbyStats(stats)
        setLastRefresh(new Date())
      })
      .catch(() => {})
      .finally(() => setRefreshing(false))
  }

  useEffect(() => {
    refreshStats()
    const id = setInterval(refreshStats, 5000)
    return () => clearInterval(id)
  }, [])

  const handleSwitchToRoom = (lobbyCode: string) => {
    if (switching || lobbyCode === currentLobby) return
    setSwitching(true)

    sessionStorage.setItem('targetLobby', lobbyCode)
    
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('admin', 'admin')
    url.searchParams.set('autoJoin', 'true')
    
    window.location.href = url.toString()
  }

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
                  👥 {playerCount}/{MAX_PLAYERS_PER_LOBBY}
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
                      onClick={() => removeRemotePlayer(player.id)}
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
                  onClick={() => playersInLobby.forEach(p => removeRemotePlayer(p.id))}
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

          {/* Quick Lobby Switch + Fake Players */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <p className="admin-panel-subtitle" style={{ margin: 0 }}>Lobbies (+ Fake Players)</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {lastRefresh && (
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
                  {lastRefresh.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={refreshStats}
                disabled={refreshing}
                style={{
                  padding: '2px 8px',
                  background: refreshing ? 'rgba(74, 158, 255, 0.3)' : 'rgba(74, 158, 255, 0.15)',
                  border: '1px solid rgba(74, 158, 255, 0.3)',
                  borderRadius: '4px',
                  color: '#4a9eff',
                  fontSize: '9px',
                  fontWeight: '700',
                  cursor: refreshing ? 'default' : 'pointer',
                }}
              >
                {refreshing ? '...' : '🔄 Refresh'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', maxHeight: '280px', overflowY: 'auto' }}>
            {lobbyCodes.map((code) => {
              const isCurrent = code === currentLobby
              // For current lobby: use real PlayroomKit count (always accurate)
              // For other lobbies: use API count
              const count = isCurrent ? playerCount : (lobbyStats[code] ?? 0)
              const isFull = count >= MAX_PLAYERS_PER_LOBBY
              const handleFakeAdd = async (e: React.MouseEvent) => {
                e.stopPropagation()
                await fakeJoin(code, 1)
                setLobbyStats(prev => ({ ...prev, [code]: (prev[code] ?? 0) + 1 }))
              }
              const handleFakeRemove = async (e: React.MouseEvent) => {
                e.stopPropagation()
                if (count <= 0) return
                await fakeLeave(code, 1)
                setLobbyStats(prev => ({ ...prev, [code]: Math.max(0, (prev[code] ?? 0) - 1) }))
              }
              return (
                <div key={code} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 8px',
                  background: isCurrent ? 'rgba(0, 255, 135, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${isCurrent ? 'rgba(0, 255, 135, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '6px',
                }}>
                  <span style={{
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: isCurrent ? '#00ff87' : '#fff',
                    fontWeight: isCurrent ? '700' : '500',
                  }}>
                    {code}
                    <span style={{
                      marginLeft: '4px',
                      color: isFull ? '#ff4a4a' : '#4a9eff',
                      fontWeight: '700',
                    }}>
                      [{count}/{MAX_PLAYERS_PER_LOBBY}]
                    </span>
                  </span>
                  {/* Fake player buttons */}
                  <button onClick={handleFakeRemove} style={{
                    width: '20px', height: '20px', padding: 0,
                    background: 'rgba(255, 60, 60, 0.2)', border: '1px solid rgba(255, 60, 60, 0.4)',
                    borderRadius: '4px', color: '#ff4a4a', fontSize: '12px', fontWeight: '700',
                    cursor: 'pointer', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>−</button>
                  <button onClick={handleFakeAdd} style={{
                    width: '20px', height: '20px', padding: 0,
                    background: 'rgba(0, 255, 135, 0.2)', border: '1px solid rgba(0, 255, 135, 0.4)',
                    borderRadius: '4px', color: '#00ff87', fontSize: '12px', fontWeight: '700',
                    cursor: 'pointer', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>+</button>
                  {/* Join button */}
                  <button
                    onClick={() => handleSwitchToRoom(code)}
                    disabled={switching || isCurrent}
                    style={{
                      padding: '2px 8px',
                      background: isCurrent ? 'transparent' : 'rgba(74, 158, 255, 0.15)',
                      border: `1px solid ${isCurrent ? 'rgba(0,255,135,0.3)' : 'rgba(74, 158, 255, 0.3)'}`,
                      borderRadius: '4px',
                      color: isCurrent ? '#00ff87' : '#4a9eff',
                      fontSize: '9px', fontWeight: '700',
                      cursor: isCurrent || switching ? 'default' : 'pointer',
                    }}
                  >
                    {isCurrent ? '● Here' : '➡'}
                  </button>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => setVisibleCount(v => v + 5)}
            style={{
              width: '100%',
              padding: '5px',
              marginBottom: '12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '600',
            }}
          >
            + Show More Lobbies
          </button>

          {/* Reset all lobbies */}
          <button
            onClick={async () => {
              if (confirm('Reset ALL lobby data? This clears all player counts.')) {
                await resetLobbies()
                setLobbyStats({})
              }
            }}
            style={{
              width: '100%',
              padding: '6px',
              marginBottom: '12px',
              background: 'rgba(255, 60, 60, 0.1)',
              border: '1px solid rgba(255, 60, 60, 0.25)',
              borderRadius: '6px',
              color: '#ff6b6b',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: '700',
            }}
          >
            ⚠ Reset All Lobby Data
          </button>

          <div className="admin-panel-info">
            <p>💡 <strong>Player counts are live</strong> from the lobby API (updates every 5s)</p>
            <p>🔄 <strong>Stale cleanup:</strong> Players without heartbeat are removed after 30s</p>
            <p>🎮 <strong>Hotkey:</strong> Press <kbd>Ctrl+A</kbd> to toggle this panel</p>
          </div>
        </div>
      </div>
    </div>
  )
}
