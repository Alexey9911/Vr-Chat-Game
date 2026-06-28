import React, { useState, useEffect } from 'react'
import { X, Play, Square, Loader2 } from 'lucide-react'
import { playYouTubeAudio, stopYouTubeAudio, isYouTubeAudioPlaying, getCurrentVideoTitle, setYouTubeVolume, extractVideoId } from '../../lib/audio/youtubePlayer'
import { stopMusicForPlayer } from '../../lib/audio/musicSystem'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { useSettingsStore } from '../../lib/settings/settingsStore'
import { isGeckos, setLocalState as netSetLocalState, setMediaStartEpoch as netSetMediaStartEpoch } from '../../lib/net/netClient'

interface YouTubeModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function YouTubeModal({ isOpen, onClose }: YouTubeModalProps) {
  const isConnected = useMultiplayerStore((s) => s.isConnected)
  const volume = useSettingsStore((s) => s.volume)

  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [title, setTitle] = useState('')

  // Sync playing state
  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => {
      setPlaying(isYouTubeAudioPlaying())
      setTitle(getCurrentVideoTitle())
    }, 500)
    return () => clearInterval(interval)
  }, [isOpen])

  // YouTube volume follows music volume
  useEffect(() => {
    if (isOpen) setYouTubeVolume(volume / 100)
  }, [volume, isOpen])

  const handlePlay = async () => {
    setError('')
    if (!url.trim()) return
    setLoading(true)
    try {
      // geckos: broadcast persistent per-player YT state (videoId + mediaStartEpoch) so late joiners hear it.
      if (isGeckos()) {
        const localId = useMultiplayerStore.getState().localPlayerId
        if (localId) {
          // Mutual exclusion: stop our skin music first.
          stopMusicForPlayer(localId)
        }
        const info = await playYouTubeAudio(url)
        setTitle(info.title)
        setPlaying(true)
        netSetMediaStartEpoch(Date.now())
        netSetLocalState({ isYouTubePlaying: true, youtubeVideoId: info.videoId, isMusicPlaying: false })
        return
      }

      // Mutual exclusion: stop skin music if playing
      try {
        const pk = await import('playroomkit')
        const me = pk.myPlayer?.()
        if (me?.id) {
          const isSkinPlaying = me.getState('isMusicPlaying')
          if (isSkinPlaying) {
            stopMusicForPlayer(me.id)
            me.setState('isMusicPlaying', false)
            me.setState('musicData', null)
            const { RPC } = pk
            RPC.call('stopMusic', { playerId: me.id }, RPC.Mode.ALL)
          }
        }
      } catch {}

      const info = await playYouTubeAudio(url)
      setTitle(info.title)
      setPlaying(true)

      // Set PlayroomKit state so other players' polling picks it up
      try {
        const pk = await import('playroomkit')
        const me = pk.myPlayer?.()
        if (me?.id) {
          me.setState('isYouTubePlaying', true)
          me.setState('youtubeData', { videoId: info.videoId, startTime: Date.now() })
        }
      } catch (err) {
        console.warn('[YouTube] State set failed:', err)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to play YouTube audio')
    } finally {
      setLoading(false)
    }
  }

  const handleStop = () => {
    stopYouTubeAudio()
    setPlaying(false)
    setTitle('')
    setError('')

    if (isGeckos()) {
      netSetMediaStartEpoch(undefined)
      netSetLocalState({ isYouTubePlaying: false, youtubeVideoId: undefined })
      return
    }

    // Clear PlayroomKit state
    try {
      import('playroomkit').then((pk) => {
        const me = pk.myPlayer?.()
        if (me?.id) {
          me.setState('isYouTubePlaying', false)
          me.setState('youtubeData', null)
        }
      }).catch(() => {})
    } catch {}
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handlePlay()
    }
  }

  if (!isOpen || !isConnected) return null

  return (
    <div className="skins-modal-overlay" onClick={onClose}>
      <div className="skins-modal-panel" onClick={(e) => e.stopPropagation()} style={{
        maxWidth: '400px',
        padding: '20px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/youtube-icon.svg" alt="YouTube" style={{ width: '24px', height: '24px' }} />
            <span style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>YouTube</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Now Playing */}
        {playing && title && (
          <div style={{
            background: 'rgba(255,0,0,0.1)',
            border: '1px solid rgba(255,0,0,0.3)',
            borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#ff0000', animation: 'pulse 1.5s infinite',
            }} />
            <span style={{ fontSize: '13px', color: '#ff8888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {title}
            </span>
          </div>
        )}

        {/* URL Input */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste YouTube URL..."
            disabled={loading || playing}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#fff',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          {playing ? (
            <button onClick={handleStop} style={{
              background: 'rgba(255,0,0,0.2)',
              border: '1px solid rgba(255,0,0,0.4)',
              borderRadius: '8px',
              padding: '8px 14px',
              color: '#ff4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              fontWeight: '600',
            }}>
              <Square size={14} fill="currentColor" /> Stop
            </button>
          ) : (
            <button onClick={handlePlay} disabled={loading || !url.trim()} style={{
              background: 'rgba(255,0,0,0.2)',
              border: '1px solid rgba(255,0,0,0.4)',
              borderRadius: '8px',
              padding: '8px 14px',
              color: loading ? '#666' : '#ff4444',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              fontWeight: '600',
              opacity: loading || !url.trim() ? 0.5 : 1,
            }}>
              {loading ? <Loader2 size={14} className="spin" /> : <Play size={14} fill="currentColor" />}
              {loading ? 'Loading' : 'Play'}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(255,50,50,0.1)',
            border: '1px solid rgba(255,50,50,0.3)',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '12px',
            color: '#ff6666',
            marginBottom: '8px',
          }}>
            {error}
          </div>
        )}

        {/* Hint */}
        <div style={{ fontSize: '11px', color: '#555', textAlign: 'center' }}>
          Everyone in the lobby will hear the music • Volume follows Music slider
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  )
}
