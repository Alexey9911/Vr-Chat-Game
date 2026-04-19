// Emotes configuration for chat system
// GIFs should be placed in /public/emotes/ and optimized versions in /public/emotes/optimized/

import { KlipyGif, getOptimizedGifUrl } from '../api/klipyClient'

export interface Emote {
  id: string
  name: string
  url: string
  type: 'gif' | 'png' | 'webp' | 'video'
  keywords?: string[] // For search functionality
}

// Cache for KLIPY GIFs (stored in memory)
const klipyGifCache = new Map<string, string>()

// Emotes collection
// Add your emotes here - they will be available in the chat picker
// NOTE: Local emotes are commented out until GIF files are added to /public/emotes/
export const EMOTES: Emote[] = [
  {
    id: 'alonGif1',
    name: 'Alon GIF',
    url: '/alon_house/gifs/gif1.gif',
    type: 'gif',
    keywords: ['alon', 'gif', 'meme'],
  },
  {
    id: 'alonImage',
    name: 'Alon Image',
    url: '/alon_house/gifs/image.gif',
    type: 'gif',
    keywords: ['alon', 'image', 'meme'],
  },
  {
    id: 'alonVideo1',
    name: 'Alon Video',
    url: '/alon_house/gifs/video1.mp4',
    type: 'video',
    keywords: ['alon', 'video', 'meme'],
  },
]

// Helper to get emote by ID
export function getEmoteById(id: string): Emote | undefined {
  return EMOTES.find((e) => e.id === id)
}

// Store KLIPY GIF URL in cache
export function cacheKlipyGif(gif: KlipyGif) {
  const gifUrl = getOptimizedGifUrl(gif)
  const key = `klipy_${gif.id}`
  
  klipyGifCache.set(key, gifUrl)
  
  // Also store in localStorage for persistence
  try {
    const stored = localStorage.getItem('klipyGifCache') || '{}'
    const cache = JSON.parse(stored)
    cache[key] = gifUrl
    localStorage.setItem('klipyGifCache', JSON.stringify(cache))
  } catch (e) {
  }
}

// Get KLIPY GIF URL from cache
export function getKlipyGifUrl(klipyId: string): string | undefined {
  // Check memory cache first
  const cached = klipyGifCache.get(klipyId)
  if (cached) {
    return cached
  }
  
  // Check localStorage
  try {
    const stored = localStorage.getItem('klipyGifCache')
    if (stored) {
      const cache = JSON.parse(stored)
      const url = cache[klipyId]
      if (url) {
        klipyGifCache.set(klipyId, url)
        return url
      }
    }
  } catch (e) {
  }
  
  return undefined
}

// Helper to parse emote codes in text (e.g., ":trump:" or ":klipy_123:" -> emote object)
export function parseEmoteCodes(text: string): Array<{ type: 'text' | 'emote' | 'klipy'; content: string; url?: string }> {
  const parts: Array<{ type: 'text' | 'emote' | 'klipy'; content: string; url?: string }> = []
  const regex = /\[gif:([^\]]+)\]|:(\w+):/gi
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }

    // [GIF:URL] token (case-insensitive)
    if (match[1]) {
      const url = match[1]
      parts.push({ type: 'klipy', content: 'gif', url })
    } else if (match[2]) {
      const emoteId = match[2]

      if (emoteId.startsWith('klipy_')) {
        const gifUrl = getKlipyGifUrl(emoteId)
        if (gifUrl) {
          parts.push({ type: 'klipy', content: emoteId, url: gifUrl })
        } else {
          parts.push({ type: 'text', content: `:${emoteId}:` })
        }
      } else if (getEmoteById(emoteId)) {
        parts.push({ type: 'emote', content: emoteId })
      } else {
        parts.push({ type: 'text', content: `:${emoteId}:` })
      }
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }]
}

// Validate message doesn't have too many emotes (spam prevention)
export function validateEmoteCount(text: string, maxEmotes: number = 5): boolean {
  const matches = text.match(/:(\w+):/g)
  return !matches || matches.length <= maxEmotes
}
