import React, { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { useKeyboardStore } from '../../lib/useKeyboardStore'
import EmotePickerNew from './EmotePickerNew'
import GifBar from './GifBar'
import { Emote, parseEmoteCodes, getEmoteById, validateEmoteCount } from '../../lib/emotes/emotesConfig'

// Format timestamp as [HH:MM:SS] in 24h
function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  return `[${hh}:${mm}:${ss}]`
}

function InlineGif({ url }: { url: string }) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const giphyMatch = url.match(/media\.giphy\.com\/media\/([a-zA-Z0-9]+)\//)
  const pageUrl = giphyMatch ? `https://giphy.com/gifs/${giphyMatch[1]}` : url
  return (
    <span
      className="chat-gif-inline-wrapper"
      onMouseEnter={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setMousePos(null)}
    >
      <a href={pageUrl} target="_blank" rel="noopener noreferrer">
        <img src={url} alt="GIF" className="chat-gif-inline-thumb" title="Click to open GIF" />
      </a>
      {mousePos && (
        <div
          className="chat-gif-inline-expand"
          style={{
            position: 'fixed',
            left: mousePos.x + 12,
            top: Math.max(8, mousePos.y - 260),
            transform: 'none',
            bottom: 'auto',
          }}
        >
          <img src={url} alt="GIF expanded" />
        </div>
      )}
    </span>
  )
}

export default function ChatInput() {
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState('')
  const [gifUrls, setGifUrls] = useState<string[]>([])
  const [hoveredGifChip, setHoveredGifChip] = useState<number | null>(null)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const {
    chatMessages,
    isConnected,
    addChatMessage,
    updateRemotePlayer,
    remotePlayers,
  } = useMultiplayerStore()
  const { setChatActive } = useKeyboardStore()

  const playroomRef = useRef<any>(null)
  useEffect(() => {
    // @ts-ignore
    import('playroomkit').then((mod: any) => { playroomRef.current = mod })
  }, [])

  // No pre-cache required for GIPHY URL mode; local emotes are static assets

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [chatMessages])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isConnected) return
      if (e.key === 'Enter' && !isOpen) {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(true)
        setChatActive(true)
        setTimeout(() => {
          inputRef.current?.focus()
          if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
        }, 50)
      }
      if (e.key === 'Escape' && isOpen) {
        if (isPickerOpen) {
          setIsPickerOpen(false)
        } else {
          setIsOpen(false)
          setText('')
          setGifUrls([])
          setChatActive(false)
          inputRef.current?.blur()
        }
      }
      if (e.key === 'Tab' && isOpen) {
        e.preventDefault()
        setIsPickerOpen(!isPickerOpen)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        setIsPickerOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isConnected, setChatActive])

  const handleEmoteSelect = (emote: Emote) => {
    if (!isOpen) { setIsOpen(true); setChatActive(true) }
    const emoteCode = `:${emote.id}:`
    setText((prev) => (prev + emoteCode).slice(0, 100))
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleGifUrlSelect = (url: string) => {
    if (!isOpen) { setIsOpen(true); setChatActive(true) }
    setGifUrls((prev) => [...prev, url])
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleOpenPicker = () => {
    // Open chat if closed
    if (!isOpen) {
      setIsOpen(true)
      setChatActive(true)
    }
    // Open picker
    setIsPickerOpen(true)
    // Focus input after a brief delay
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const sendMessage = () => {
    const full = text + gifUrls.map((url) => `[GIF:${url}]`).join('')
    if (!full.trim()) return

    const pk = playroomRef.current
    if (!pk) return
    const me = pk.myPlayer()
    if (!me) return

    const profile = me.getState('pdata')
    const chatData = {
      text: full.trim(),
      timestamp: Date.now(),
    }

    // Sync to other players via PlayerState
    me.setState('chatMessage', chatData, true)

    // Add locally immediately with player color
    addChatMessage({
      id: chatData.timestamp.toString() + '-' + me.id,
      playerId: me.id,
      playerName: profile?.name || 'Anonymous',
      playerColor: profile?.colors?.primary || profile?.color || '#ffb84d',
      text: chatData.text,
      timestamp: chatData.timestamp,
    })

    // Show local player's own chat bubble above their head
    updateRemotePlayer(me.id, { chatMessage: chatData.text })
    setTimeout(() => {
      updateRemotePlayer(me.id, { chatMessage: null })
    }, 5000)

    setText('')
    setGifUrls([])
    setIsPickerOpen(false)
    // Keep chat OPEN after sending — fixes scroll jumping to top
    // User can press Escape to close manually
    
    // Force scroll to bottom after sending message
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight
      }
      inputRef.current?.focus()
    }, 50)
  }

  // Render message text with emotes (local and KLIPY)
  const renderMessageWithEmotes = (text: string) => {
    const parts = parseEmoteCodes(text)
    return parts.map((part, index) => {
      if (part.type === 'emote') {
        const emote = getEmoteById(part.content)
        if (emote) {
          return (
            <img
              key={index}
              src={emote.url}
              alt={emote.name}
              className="chat-emote-inline"
              title={emote.name}
            />
          )
        }
      }
      if (part.type === 'klipy' && part.url) {
        return <InlineGif key={index} url={part.url} />
      }
      return <span key={index}>{part.content}</span>
    })
  }

  if (!isConnected) return null

  // Last 5 messages — always visible (transparent)
  const recentMessages = chatMessages.slice(-5)

  return (
    <div className="chat-container">
      {/* ALWAYS VISIBLE: Recent messages (transparent background) */}
      <div className={`chat-live-log ${isOpen ? 'chat-live-log--open' : ''}`} ref={logRef}>
        {!isOpen && recentMessages.map((msg) => {
          const player = remotePlayers.get(msg.playerId)
          const isAdmin = player?.isAdmin || false
          return (
            <div key={msg.id} className="chat-live-msg">
              <span className="chat-live-time">{formatTime(msg.timestamp)}</span>{' '}
              <span 
                className={`chat-live-name ${isAdmin ? 'admin-nickname' : ''}`}
                style={!isAdmin ? { color: msg.playerColor || '#ffb84d' } : {}}
              >
                {msg.playerName}
              </span>
              <span className="chat-live-text">: {renderMessageWithEmotes(msg.text)}</span>
            </div>
          )
        })}

        {/* OPENED: Full history with dark background */}
        {isOpen && (
          <div className="chat-history">
            {chatMessages.length === 0 && (
              <div className="chat-empty">No messages yet...</div>
            )}
            {chatMessages.map((msg) => {
              const player = remotePlayers.get(msg.playerId)
              const isAdmin = player?.isAdmin || false
              return (
                <div key={msg.id} className="chat-msg">
                  <span className="chat-msg-time">{formatTime(msg.timestamp)}</span>{' '}
                  <span 
                    className={`chat-msg-name ${isAdmin ? 'admin-nickname' : ''}`}
                    style={!isAdmin ? { color: msg.playerColor || '#ff9d00' } : {}}
                  >
                    {msg.playerName}
                  </span>
                  <span className="chat-msg-text">: {renderMessageWithEmotes(msg.text)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Input — shown when open */}
      {isOpen && (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage() }}
            className="chat-input-form"
          >
            <button
              type="button"
              className="chat-emote-button"
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              title="Open emote picker (Tab)"
            >
              😀
            </button>
            <div className="chat-input-composite">
              {gifUrls.map((url, i) => (
                <span
                  key={i}
                  className="gif-input-chip"
                  onMouseEnter={() => setHoveredGifChip(i)}
                  onMouseLeave={() => setHoveredGifChip(null)}
                >
                  <span className="gif-chip-label">GIF</span>
                  {hoveredGifChip === i && (
                    <div className="gif-chip-preview">
                      <img src={url} alt="GIF preview" />
                    </div>
                  )}
                  <button
                    type="button"
                    className="gif-chip-remove"
                    onClick={() => setGifUrls((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 100))}
                placeholder={gifUrls.length > 0 ? '' : 'Type a message...'}
                maxLength={100}
                className="chat-input"
              />
              {text.length > 0 && (
                <span className={`chat-char-counter ${text.length >= 90 ? 'chat-char-counter--warn' : ''} ${text.length >= 100 ? 'chat-char-counter--max' : ''}`}>
                  {text.length}/100
                </span>
              )}
            </div>
            <button
              type="submit"
              className="chat-send-btn"
              title="Send (Enter)"
              disabled={!text.trim() && gifUrls.length === 0}
            >
              <Send size={15} />
            </button>
          </form>
          <EmotePickerNew
            isOpen={isPickerOpen}
            onEmoteSelect={handleEmoteSelect}
            onGifUrlSelect={handleGifUrlSelect}
            onClose={() => setIsPickerOpen(false)}
          />
        </>
      )}

      {/* Hint */}
      {!isOpen && (
        <div className="chat-hint">Press <strong>Enter</strong> to chat</div>
      )}

      {/* GIF Bar - Always visible when connected, above chat hint */}
      <GifBar
        onGifSelect={handleEmoteSelect}
        onOpenPicker={handleOpenPicker}
      />
    </div>
  )
}
