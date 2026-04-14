import React, { useState, useEffect, useRef } from 'react'
import { EMOTES, Emote } from '../../lib/emotes/emotesConfig'
import {
  getTrendingGifs,
  searchGifs,
  getOptimizedGifUrl,
  hasApiKey,
} from '../../lib/api/giphyClient'
import type { GiphyGif } from '../../lib/api/giphyClient'

interface EmotePickerProps {
  onEmoteSelect: (emote: Emote) => void
  onGifUrlSelect: (url: string) => void
  isOpen: boolean
  onClose: () => void
}

export default function EmotePickerNew({ 
  onEmoteSelect,
  onGifUrlSelect,
  isOpen, 
  onClose
}: EmotePickerProps) {
  const [activeTab, setActiveTab] = useState<'local' | 'trending' | 'search'>('trending')
  const [trendingGifs, setTrendingGifs] = useState<GiphyGif[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GiphyGif[]>([])
  const [loading, setLoading] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // Load trending GIFs on open
  useEffect(() => {
    if (isOpen && activeTab === 'trending' && trendingGifs.length === 0) {
      loadTrending()
    }
  }, [isOpen, activeTab])

  // Search with debounce
  useEffect(() => {
    if (activeTab === 'search' && searchQuery.trim()) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery)
      }, 500)
    } else if (activeTab === 'search' && !searchQuery.trim()) {
      setSearchResults([])
    }
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, activeTab])

  const loadTrending = async () => {
    setLoading(true)
    try {
      const gifs = await getTrendingGifs(10)
      setTrendingGifs(gifs)
    } catch (error) {
    }
    setLoading(false)
  }

  const performSearch = (query: string) => {
    setLoading(true)
    try {
      const lowerQuery = query.toLowerCase()
      searchGifs(lowerQuery, 20).then((res) => {
        setSearchResults(res)
        setLoading(false)
      })
    } catch (error) {
      setSearchResults([])
      setLoading(false)
    }
  }

  const handleGifClick = (gif: GiphyGif) => {
    const url = getOptimizedGifUrl(gif)
    if (url) {
      onGifUrlSelect(url)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="emote-picker-overlay-new" onClick={onClose}>
      <div className="emote-picker-new" onClick={(e) => e.stopPropagation()}>
        {/* Header with tabs */}
        <div className="emote-picker-header-new">
          <div className="emote-picker-tabs">
            <button
              className={`emote-picker-tab ${activeTab === 'local' ? 'active' : ''}`}
              onClick={() => setActiveTab('local')}
            >
              📁 Local
            </button>
            <button
              className={`emote-picker-tab ${activeTab === 'trending' ? 'active' : ''}`}
              onClick={() => setActiveTab('trending')}
            >
              🔥 Trending
            </button>
            <button
              className={`emote-picker-tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              🔍 Search
            </button>
          </div>
          <button className="emote-picker-close-new" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Search bar - only for search tab */}
        {activeTab === 'search' && (
          <div className="emote-picker-search-bar">
            <input
              type="text"
              className="emote-picker-search-input"
              placeholder="Search GIFs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Content area */}
        <div className="emote-picker-content">
          {loading && (
            <div className="emote-picker-loading">
              <div className="emote-picker-spinner">🔄</div>
              <p>Loading GIFs...</p>
            </div>
          )}

          {/* Local Tab */}
          {activeTab === 'local' && !loading && (
            <div className="emote-picker-grid-new">
              {EMOTES.length === 0 && (
                <div className="emote-picker-empty-new">
                  <p>No local GIFs configured</p>
                  <p className="emote-picker-hint-new">Add files under /public/emotes or /public/gifs</p>
                </div>
              )}
              {EMOTES.map((emote) => (
                <button
                  key={emote.id}
                  className="emote-picker-item-new"
                  onClick={() => onEmoteSelect(emote)}
                  onMouseEnter={() => setHoveredItem(emote.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  title={emote.name}
                >
                  <img
                    src={emote.url}
                    alt={emote.name}
                    className="emote-picker-img-new"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0.5'
                    }}
                  />
                  {hoveredItem === emote.id && (
                    <div className="emote-picker-tooltip-new">{emote.name}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* API key warning — shown on Trending/Search tabs when key is missing */}
          {(activeTab === 'trending' || activeTab === 'search') && !hasApiKey() && (
            <div className="emote-picker-empty-new" style={{ padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '20px', marginBottom: '6px' }}>🔑</p>
              <p style={{ fontWeight: 600 }}>GIPHY API key not set</p>
              <p className="emote-picker-hint-new">
                Add <code>NEXT_PUBLIC_GIPHY_API_KEY=...</code> to your <code>.env.local</code> and restart the server
              </p>
            </div>
          )}

          {/* Trending Tab */}
          {activeTab === 'trending' && !loading && hasApiKey() && (
            <div className="emote-picker-grid-new">
              {trendingGifs.map((gif) => (
                <button
                  key={gif.id}
                  className="emote-picker-item-new"
                  onClick={() => handleGifClick(gif)}
                  onMouseEnter={() => setHoveredItem(gif.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  title={gif.title}
                >
                  <img
                    src={getOptimizedGifUrl(gif)}
                    alt={gif.title}
                    className="emote-picker-img-new"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0.5'
                    }}
                  />
                  {hoveredItem === gif.id && (
                    <div className="emote-picker-tooltip-new">{gif.title}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && !loading && hasApiKey() && (
            <div className="emote-picker-grid-new">
              {searchResults.length === 0 && searchQuery.trim() && (
                <div className="emote-picker-empty-new">
                  <p>No results found for "{searchQuery}"</p>
                  <p className="emote-picker-hint-new">Try: happy, fire, love, sad, excited</p>
                </div>
              )}
              {searchResults.length === 0 && !searchQuery.trim() && (
                <div className="emote-picker-empty-new">
                  <p>Type to search GIFs</p>
                  <p className="emote-picker-hint-new">Search by name or tag</p>
                </div>
              )}
              {searchResults.map((gif) => (
                <button
                  key={gif.id}
                  className="emote-picker-item-new"
                  onClick={() => handleGifClick(gif)}
                  onMouseEnter={() => setHoveredItem(gif.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  title={gif.title}
                >
                  <img
                    src={getOptimizedGifUrl(gif)}
                    alt={gif.title}
                    className="emote-picker-img-new"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0.5'
                    }}
                  />
                  {hoveredItem === gif.id && (
                    <div className="emote-picker-tooltip-new">{gif.title}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="emote-picker-footer-new">
          <p className="emote-picker-attribution">
            Powered by <a href="https://giphy.com" target="_blank" rel="noopener noreferrer">GIPHY</a>
          </p>
        </div>
      </div>
    </div>
  )
}
