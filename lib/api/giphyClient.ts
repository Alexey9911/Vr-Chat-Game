/**
 * GIPHY API Client
 * Official REST API wrapper (lightweight) with simple in-memory cache.
 * https://developers.giphy.com/docs/api/
 */

export interface GiphyImageVariant {
  url?: string
  mp4?: string
  webp?: string
  width?: string
  height?: string
  size?: string
}

export interface GiphyGif {
  id: string
  title: string
  images: {
    original?: GiphyImageVariant
    downsized?: GiphyImageVariant
    downsized_small?: GiphyImageVariant
    preview_gif?: GiphyImageVariant
    fixed_height?: GiphyImageVariant
    fixed_height_small?: GiphyImageVariant
    fixed_width?: GiphyImageVariant
    fixed_width_small?: GiphyImageVariant
  }
  rating?: string
}

interface GiphySearchResponse {
  data: GiphyGif[]
  pagination?: { total_count: number; count: number; offset: number }
  meta?: { status: number; msg: string }
}

const GIPHY_BASE_URL = 'https://api.giphy.com/v1'
const API_KEY = 'ajFiR09wcmDKrlRBNWGDC9d0WejnrCFR'

export function hasApiKey(): boolean {
  return !!API_KEY
}

// In-memory caches
let trendingCache: { data: GiphyGif[]; timestamp: number } | null = null
const searchCache = new Map<string, { data: GiphyGif[]; timestamp: number }>()

const ONE_HOUR = 60 * 60 * 1000
const FIFTEEN_MIN = 15 * 60 * 1000

function cacheIsFresh(ts: number, maxAge: number) {
  return Date.now() - ts < maxAge
}

// API key loaded silently

export function getOptimizedGifUrl(gif: GiphyGif): string {
  // Prefer small animated GIF variants
  return (
    gif.images.fixed_height_small?.url ||
    gif.images.fixed_width_small?.url ||
    gif.images.preview_gif?.url ||
    gif.images.downsized?.url ||
    gif.images.original?.url ||
    ''
  )
}

export function getPreviewGifUrl(gif: GiphyGif): string {
  return (
    gif.images.preview_gif?.url ||
    gif.images.fixed_width_small?.url ||
    gif.images.fixed_height_small?.url ||
    gif.images.downsized?.url ||
    gif.images.original?.url ||
    ''
  )
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    // eslint-disable-next-line no-console
    // console.error('[GIPHY] Request failed', res.status, text.slice(0, 300))
    throw new Error(`GIPHY request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function getTrendingGifs(limit: number = 10): Promise<GiphyGif[]> {
  if (!API_KEY) {
    // eslint-disable-next-line no-console
    // console.error('[GIPHY] Cannot fetch trending — NEXT_PUBLIC_GIPHY_API_KEY is not set in .env.local')
    return []
  }
  if (trendingCache && cacheIsFresh(trendingCache.timestamp, ONE_HOUR)) {
    return trendingCache.data.slice(0, limit)
  }
  const params = new URLSearchParams({ api_key: API_KEY, limit: String(limit), rating: 'g' })
  const url = `${GIPHY_BASE_URL}/gifs/trending?${params}`
  try {
    const data = await fetchJson<GiphySearchResponse>(url)
    const gifs = data.data || []
    trendingCache = { data: gifs, timestamp: Date.now() }
    return gifs
  } catch (e) {
    // eslint-disable-next-line no-console
    // console.error('[GIPHY] Trending error:', e)
    return []
  }
}

export async function searchGifs(query: string, limit: number = 20): Promise<GiphyGif[]> {
  if (!API_KEY) {
    // eslint-disable-next-line no-console
    // console.error('[GIPHY] Cannot search — NEXT_PUBLIC_GIPHY_API_KEY is not set in .env.local')
    return []
  }
  const q = query.trim().toLowerCase()
  if (!q) return []

  const cached = searchCache.get(q)
  if (cached && cacheIsFresh(cached.timestamp, FIFTEEN_MIN)) {
    return cached.data.slice(0, limit)
  }

  const params = new URLSearchParams({ api_key: API_KEY, q, limit: String(limit), rating: 'g' })
  const url = `${GIPHY_BASE_URL}/gifs/search?${params}`
  try {
    const data = await fetchJson<GiphySearchResponse>(url)
    const gifs = data.data || []
    searchCache.set(q, { data: gifs, timestamp: Date.now() })
    return gifs
  } catch (e) {
    // eslint-disable-next-line no-console
    // console.error('[GIPHY] Search error:', e)
    return []
  }
}

export async function getGifById(id: string): Promise<GiphyGif | null> {
  const params = new URLSearchParams({ api_key: API_KEY })
  const url = `${GIPHY_BASE_URL}/gifs/${encodeURIComponent(id)}?${params}`
  try {
    const data = await fetchJson<{ data: GiphyGif }>(url)
    return data.data || null
  } catch (e) {
    // eslint-disable-next-line no-console
    // console.error('[GIPHY] getById error:', e)
    return null
  }
}
