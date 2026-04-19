import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send } from 'lucide-react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'
import { useKeyboardStore } from '../../lib/useKeyboardStore'
import EmotePickerNew from './EmotePickerNew'
import GifBar from './GifBar'
import { Emote, parseEmoteCodes, getEmoteById } from '../../lib/emotes/emotesConfig'
import { getChatHistory, sendChatMessage } from '../../lib/lobbyApi'

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

// ─── main component ──────────────────────────────────────────────────────────

export default function ChatInput() {
  // ── UI state ──────────────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState('')
  const [gifUrls, setGifUrls] = useState<string[]>([])
  const [hoveredGifChip, setHoveredGifChip] = useState<number | null>(null)
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  // ── refs ──────────────────────────────────────────────────────────────────
  const inputRef = useRef<HTMLInputElement>(null)
  // This ref points to the SCROLLABLE history container (only exists when isOpen=true)
  const historyRef = useRef<HTMLDivElement>(null)
  // Track whether user scrolled up manually — use ref, NOT state, to avoid render loops
  const userScrolledUp = useRef(false)
  // Keep latest isOpen for keydown handler without stale closures
  const isOpenRef = useRef(false)
  const isPickerOpenRef = useRef(false)
  const textRef = useRef('')
  const gifUrlsRef = useRef<string[]>([])

  // Keep refs in sync
  isOpenRef.current = isOpen
  isPickerOpenRef.current = isPickerOpen
  textRef.current = text
  gifUrlsRef.current = gifUrls

  // ── store ─────────────────────────────────────────────────────────────────
  const {
    chatMessages,
    isConnected,
    addChatMessage,
    setChatMessages,
    currentLobby,
    updateRemotePlayer,
    remotePlayers,
  } = useMultiplayerStore()
  const { setChatActive } = useKeyboardStore()

  // ── playroomkit ──────────────────────────────────────────────────────────
  const playroomRef = useRef<any>(null)
  useEffect(() => {
    // @ts-ignore
    import('playroomkit').then((mod: any) => { playroomRef.current = mod })
  }, [])

  // ── fetch history on connect ─────────────────────────────────────────────
  useEffect(() => {
    if (isConnected && currentLobby) {
      getChatHistory(currentLobby).then((history) => {
        if (history && history.length > 0) {
          setChatMessages(history)
        }
      })
    }
  }, [isConnected, currentLobby, setChatMessages])

  // ── scroll helpers ────────────────────────────────────────────────────────

  /** Instantly snap history to the newest message */
  const scrollToBottom = useCallback(() => {
    const el = historyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  /** Called by the onScroll event on the history div */
  const handleHistoryScroll = useCallback(() => {
    const el = historyRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    // If user scrolled more than 40px from bottom, pause auto-scroll
    userScrolledUp.current = distanceFromBottom > 40
  }, [])

  /**
   * When chat opens: reset the "paused" flag and scroll to bottom.
   * We use a tiny timeout so that React has rendered chat-history before we scroll.
   */
  useEffect(() => {
    if (isOpen) {
      userScrolledUp.current = false
      setTimeout(scrollToBottom, 30)
    }
  }, [isOpen, scrollToBottom])

  /**
   * When new messages arrive: auto-scroll ONLY if user hasn't scrolled up.
   */
  useEffect(() => {
    if (isOpen && !userScrolledUp.current) {
      setTimeout(scrollToBottom, 30)
    }
  }, [chatMessages, isOpen, scrollToBottom])

  // ── keyboard handler (stable — uses refs so no stale closures) ────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isConnected) return

      const open = isOpenRef.current
      const pickerOpen = isPickerOpenRef.current
      const currentText = textRef.current
      const currentGifs = gifUrlsRef.current

      // ENTER while chat is closed → open it
      if (e.key === 'Enter' && !open) {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(true)
        setChatActive(true)
        setTimeout(() => inputRef.current?.focus(), 30)
        return
      }

      // ENTER while chat is open
      if (e.key === 'Enter' && open && !pickerOpen) {
        // Empty input → close chat and give movement back
        if (!currentText.trim() && currentGifs.length === 0) {
          e.preventDefault()
          e.stopPropagation()
          closeChat()
        }
        // Non-empty → let the form's onSubmit handle it (browser default)
        return
      }

      // ESCAPE → close (or close picker first)
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        if (pickerOpen) {
          setIsPickerOpen(false)
        } else {
          closeChat()
        }
        return
      }

      // TAB → toggle emote picker
      if (e.key === 'Tab' && open) {
        e.preventDefault()
        setIsPickerOpen((v) => !v)
        return
      }

      // CTRL/CMD + G → open emote picker
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        setIsPickerOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // Stable — only re-registers when connection or setChatActive changes
  }, [isConnected, setChatActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── helpers ───────────────────────────────────────────────────────────────

  const closeChat = () => {
    setIsOpen(false)
    setText('')
    setGifUrls([])
    setIsPickerOpen(false)
    setChatActive(false)
    userScrolledUp.current = false
    inputRef.current?.blur()
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

    me.setState('chatMessage', chatData, true)

    const msg = {
      id: chatData.timestamp.toString() + '-' + me.id,
      playerId: me.id,
      playerName: profile?.name || 'Anonymous',
      playerColor: profile?.colors?.primary || profile?.color || '#ffb84d',
      text: chatData.text,
      timestamp: chatData.timestamp,
    }

    addChatMessage(msg)

    if (currentLobby) {
      sendChatMessage(currentLobby, msg)
    }

    updateRemotePlayer(me.id, { chatMessage: chatData.text })
    setTimeout(() => updateRemotePlayer(me.id, { chatMessage: null }), 5000)

    setText('')
    setGifUrls([])
    setIsPickerOpen(false)

    // After sending: always go to latest message
    userScrolledUp.current = false
    setTimeout(scrollToBottom, 30)

    // Close chat so player can move immediately
    closeChat()
  }

  const handleEmoteSelect = (emote: Emote) => {
    if (!isOpenRef.current) { setIsOpen(true); setChatActive(true) }
    setText((prev) => (prev + `:${emote.id}:`).slice(0, 100))
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleGifUrlSelect = (url: string) => {
    if (!isOpenRef.current) { setIsOpen(true); setChatActive(true) }
    setGifUrls((prev) => [...prev, url])
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleOpenPicker = () => {
    if (!isOpenRef.current) { setIsOpen(true); setChatActive(true) }
    setIsPickerOpen(true)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ── render helpers ────────────────────────────────────────────────────────

  const renderMessage = (text: string) => {
    const parts = parseEmoteCodes(text)
    return parts.map((part, index) => {
      if (part.type === 'emote') {
        const emote = getEmoteById(part.content)
        if (emote) {
          if (emote.type === 'video') {
            return (
              <video key={index} src={emote.url} className="chat-emote-inline" autoPlay loop muted playsInline title={emote.name} />
            )
          }
          return (
            <img key={index} src={emote.url} alt={emote.name} className="chat-emote-inline" title={emote.name} />
          )
        }
      }
      if (part.type === 'klipy' && part.url) {
        return <InlineGif key={index} url={part.url} />
      }
      return <span key={index}>{part.content}</span>
    })
  }

  // ── guard ─────────────────────────────────────────────────────────────────
  if (!isConnected) return null

  const recentMessages = chatMessages.slice(-5)

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="chat-container">

      {/* ── CLOSED: transparent live preview (last 5 msgs, no scroll) ── */}
      {!isOpen && (
        <div className="chat-live-log">
          {recentMessages.map((msg) => {
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
                <span className="chat-live-text">: {renderMessage(msg.text)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── OPEN: full history panel with its OWN scroll container ── */}
      {isOpen && (
        <div
          className="chat-history-panel"
          ref={historyRef}
          onScroll={handleHistoryScroll}
        >
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
                <span className="chat-msg-text">: {renderMessage(msg.text)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── INPUT (only when open) ── */}
      {isOpen && (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage() }}
            className="chat-input-form"
          >
            <button
              type="button"
              className="chat-emote-button"
              onClick={() => setIsPickerOpen((v) => !v)}
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
                placeholder={gifUrls.length > 0 ? '' : 'Type a message... (Esc to close)'}
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

      {/* ── HINT (only when closed) ── */}
      {!isOpen && (
        <div className="chat-hint">Press <strong>Enter</strong> to chat</div>
      )}

      {/* ── GIF BAR (always visible) ── */}
      <GifBar
        onGifSelect={handleEmoteSelect}
        onOpenPicker={handleOpenPicker}
      />
    </div>
  )
}
