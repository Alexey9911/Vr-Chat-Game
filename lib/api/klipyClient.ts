/**
 * KLIPY API Client
 * Free alternative to GIPHY/Tenor for GIF search
 * https://klipy.com/api
 */

export interface KlipyGif {
  id: string
  title: string
  url: string
  media_formats: {
    gif?: { url: string; size: number }
    tinygif?: { url: string; size: number }
    nanogif?: { url: string; size: number }
    mp4?: { url: string; size: number }
    webm?: { url: string; size: number }
  }
  created: number
  hasaudio: boolean
  tags: string[]
}

export interface KlipySearchResponse {
  results: KlipyGif[]
  next: string
}

export interface KlipyCategory {
  searchterm: string
  path: string
  image: string
  name: string
}

const KLIPY_BASE_URL = 'https://api.klipy.com/v1'
const API_KEY = 'yenlEqOHhzprZamg7TiXIkZb2MaY2WDF2LjRf4OwzIJ3DdDvmnnT7tK9BJjCc2G2'

// API Key loaded silently

// Cache for trending GIFs (1 hour)
let trendingCache: { data: KlipyGif[]; timestamp: number } | null = null
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

/**
 * Fallback demo GIFs when API is not available (10 GIFs)
 */
function getDemoGifs(): KlipyGif[] {
  // Returning 10 demo GIFs as fallback
  return [
    {
      id: 'demo-1',
      title: 'Happy Dance',
      url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
      media_formats: {
        gif: { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', size: 500000 },
        tinygif: { url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200.gif', size: 100000 },
      },
      created: Date.now(),
      hasaudio: false,
      tags: ['dance', 'happy', 'party'],
    },
    {
      id: 'demo-2',
      title: 'Thumbs Up',
      url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
      media_formats: {
        gif: { url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', size: 500000 },
        tinygif: { url: 'https://media.giphy.com/media/111ebonMs90YLu/200.gif', size: 100000 },
      },
      created: Date.now(),
      hasaudio: false,
      tags: ['thumbs', 'up', 'approve', 'yes'],
    },
    {
      id: 'demo-3',
      title: 'Fire',
      url: 'https://media.giphy.com/media/l0HlQXlQ3nHyLMvte/giphy.gif',
      media_formats: {
        gif: { url: 'https://media.giphy.com/media/l0HlQXlQ3nHyLMvte/giphy.gif', size: 500000 },
        tinygif: { url: 'https://media.giphy.com/media/l0HlQXlQ3nHyLMvte/200.gif', size: 100000 },
      },
      created: Date.now(),
      hasaudio: false,
      tags: ['fire', 'hot', 'lit'],
    },
    {
      id: 'demo-4',
      title: 'Clap',
      url: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif',
      media_formats: {
        gif: { url: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif', size: 500000 },
        tinygif: { url: 'https://media.giphy.com/media/7rj2ZgttvgomY/200.gif', size: 100000 },
      },
      created: Date.now(),
      hasaudio: false,
      tags: ['clap', 'applause', 'bravo'],
    },
    {
      id: 'demo-5',
      title: 'Mind Blown',
      url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
      media_formats: {
        gif: { url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif', size: 500000 },
        tinygif: { url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200.gif', size: 100000 },
      },
      created: Date.now(),
      hasaudio: false,
      tags: ['mind', 'blown', 'wow', 'shocked'],
    },
    {
      id: 'demo-6',
      title: 'Laughing',
      url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
      media_formats: {
        gif: { url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif', size: 500000 },
        tinygif: { url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200.gif', size: 100000 },
      },
      created: Date.now(),
      hasaudio: false,
      tags: ['laugh', 'lol', 'funny', 'haha'],
    },
    {
      id: 'demo-7',
      title: 'OK',
      url: 'https://media.giphy.com/media/l3q2Z6S6n38zjPswo/giphy.gif',
      media_formats: {
        gif: { url: 'https://media.giphy.com/media/l3q2Z6S6n38zjPswo/giphy.gif', size: 500000 },
        tinygif: { url: 'https://media.giphy.com/media/l3q2Z6S6n38zjPswo/200.gif', size: 100000 },
      },
      created: Date.now(),
      hasaudio: false,
      tags: ['ok', 'okay', 'good', 'agree'],
    },
    {
      id: 'demo-8',
      title: 'Love',
      url: 'https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif',
      media_formats: {
        gif: { url: 'https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif', size: 500000 },
        tinygif: { url: 'https://media.giphy.com/media/M90mJvfWfd5mbUuULX/200.gif', size: 100000 },
      },
      created: Date.now(),
      hasaudio: false,
      tags: ['love', 'heart', 'like', 'hearts'],
    },
    {
      id: 'demo-9',
      title: 'Sad',
      url: 'https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif',
      media_formats: {
        gif: { url: 'https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif', size: 500000 },
        tinygif: { url: 'https://media.giphy.com/media/OPU6wzx8JrHna/200.gif', size: 100000 },
      },
      created: Date.now(),
      hasaudio: false,
      tags: ['sad', 'cry', 'crying', 'tears'],
    },
    {
      id: 'demo-10',
      title: 'Excited',
      url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
      media_formats: {
        gif: { url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif', size: 500000 },
        tinygif: { url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/200.gif', size: 100000 },
      },
      created: Date.now(),
      hasaudio: false,
      tags: ['excited', 'yay', 'celebration', 'happy'],
    },
  ]
}

/**
 * Export demo GIFs for external use (e.g., pre-caching)
 */
export function getPublicDemoGifs(): KlipyGif[] {
  return getDemoGifs()
}

/**
 * Search GIFs by query
 */
export async function searchGifs(
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<KlipyGif[]> {
  try {
    // Simplified params - remove media_filter
    const params = new URLSearchParams({
      q: query,
      key: API_KEY,
      limit: limit.toString(),
    })

    const url = `${KLIPY_BASE_URL}/gifs/search?${params}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      return []
    }

    const data: KlipySearchResponse = await response.json()
    return data.results || []
  } catch (error) {
    return []
  }
}

/**
 * Get trending GIFs (with cache)
 */
export async function getTrendingGifs(limit: number = 10): Promise<KlipyGif[]> {
  // Check cache
  if (trendingCache && Date.now() - trendingCache.timestamp < CACHE_DURATION) {
    return trendingCache.data.slice(0, limit)
  }

  try {
    // Try without media_filter first
    const params = new URLSearchParams({
      key: API_KEY,
      limit: limit.toString(),
    })

    const url = `${KLIPY_BASE_URL}/gifs/trending?${params}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      return []
    }

    const text = await response.text()
    
    if (!text || text.trim() === '') {
      return getDemoGifs()
    }
    
    const data: KlipySearchResponse = JSON.parse(text)
    const gifs = data.results || []
    if (gifs.length > 0) {
    }

    // Update cache
    trendingCache = {
      data: gifs,
      timestamp: Date.now(),
    }

    return gifs
  } catch (error) {
    return []
  }
}

/**
 * Get GIF categories
 */
export async function getCategories(): Promise<KlipyCategory[]> {
  try {
    const params = new URLSearchParams({
      key: API_KEY,
      type: 'featured',
    })

    const response = await fetch(`${KLIPY_BASE_URL}/categories?${params}`)
    
    if (!response.ok) {
      return []
    }

    const data: { tags: KlipyCategory[] } = await response.json()
    return data.tags || []
  } catch (error) {
    return []
  }
}

/**
 * Get GIF by ID
 */
export async function getGifById(id: string): Promise<KlipyGif | null> {
  try {
    const params = new URLSearchParams({
      key: API_KEY,
      ids: id,
    })

    const response = await fetch(`${KLIPY_BASE_URL}/gifs?${params}`)
    
    if (!response.ok) {
      return null
    }

    const data: KlipySearchResponse = await response.json()
    return data.results?.[0] || null
  } catch (error) {
    return null
  }
}

/**
 * Get optimized GIF URL (smallest format)
 */
export function getOptimizedGifUrl(gif: KlipyGif): string {
  // Priority: nanogif > tinygif > gif
  return (
    gif.media_formats.nanogif?.url ||
    gif.media_formats.tinygif?.url ||
    gif.media_formats.gif?.url ||
    gif.url
  )
}

/**
 * Test function to verify API is working
 */
export async function testKlipyAPI(): Promise<void> {
  
  try {
    const url = `${KLIPY_BASE_URL}/gifs/trending?key=${API_KEY}&limit=5`
    
    const response = await fetch(url)
    
    const text = await response.text()
    
    try {
      const json = JSON.parse(text)
    } catch (e) {
    }
  } catch (error) {
  }
}

/**
 * Get preview GIF URL (medium quality)
 */
export function getPreviewGifUrl(gif: KlipyGif): string {
  // Priority: tinygif > gif
  return (
    gif.media_formats.tinygif?.url ||
    gif.media_formats.gif?.url ||
    gif.url
  )
}
