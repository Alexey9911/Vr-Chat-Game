/**
 * Spatial Audio System
 * Adjusts audio volume based on distance between players
 * Optimized for performance with throttling
 */

import * as THREE from 'three'
import { getGlobalVolumeMultiplier } from './musicSystem'

// Configuration
export const MAX_DISTANCE = 120 // units — map is ~248x229, hear music across ~half the map
export const MAX_VOLUME = 0.5 // 50% maximum volume at 0m

// Throttling for performance
let lastUpdateTime = 0
const UPDATE_INTERVAL = 100 // Update every 100ms (10 Hz)

/**
 * Calculate volume based on distance
 * Linear falloff from MAX_VOLUME at 0m to 0 at MAX_DISTANCE
 */
export function calculateVolumeFromDistance(distance: number): number {
  if (distance >= MAX_DISTANCE) return 0
  if (distance <= 0) return MAX_VOLUME
  
  // Linear falloff: volume = (1 - distance/MAX_DISTANCE) * MAX_VOLUME
  const volumeRatio = 1 - (distance / MAX_DISTANCE)
  return Math.max(0, volumeRatio * MAX_VOLUME)
}

/**
 * Calculate 2D distance (ignoring Y axis for performance)
 */
export function calculateDistance2D(
  pos1: { x: number; z: number },
  pos2: { x: number; z: number }
): number {
  const dx = pos1.x - pos2.x
  const dz = pos1.z - pos2.z
  return Math.sqrt(dx * dx + dz * dz)
}

/**
 * Update spatial audio for all active music instances
 * Should be called from useFrame or game loop
 * Throttled to UPDATE_INTERVAL for performance
 */
export function updateSpatialAudio(
  myPosition: { x: number; z: number },
  activeAudioMap: Map<string, { audio: HTMLAudioElement; position: { x: number; z: number } }>,
  currentTime: number = performance.now()
): void {
  // Throttle updates
  if (currentTime - lastUpdateTime < UPDATE_INTERVAL) return
  lastUpdateTime = currentTime

  // Early return if no audio to update
  if (activeAudioMap.size === 0) return

  // Update volume for each active audio instance
  activeAudioMap.forEach((data, playerId) => {
    const { audio, position } = data
    
    // Skip if audio is not valid
    // Note: Don't skip paused audio — ghost audio elements (YouTube proxy)
    // may be paused by autoplay policy but still need volume updates for sync
    if (!audio || audio.error) {
      return
    }
    
    // Calculate distance
    const distance = calculateDistance2D(myPosition, position)
    
    // Calculate and apply volume (respecting user's settings multiplier)
    const distanceVolume = calculateVolumeFromDistance(distance)
    const volume = distanceVolume * getGlobalVolumeMultiplier()
    
    // Only update if volume changed significantly (avoid unnecessary updates)
    if (Math.abs(audio.volume - volume) > 0.01) {
      audio.volume = volume
    }
  })
}

/**
 * Get positions of all remote players with active music
 * Helper function to extract positions from multiplayer store
 * OPTIMIZED: Early return if no audio instances, avoid unnecessary iterations
 */
export function getActiveAudioPositions(
  remotePlayers: Array<{ id: string; position: { x: number; y: number; z: number }; isMusicPlaying?: boolean; isYouTubePlaying?: boolean }>,
  activeAudioInstances: Map<string, HTMLAudioElement>
): Map<string, { audio: HTMLAudioElement; position: { x: number; z: number } }> {
  // Early return if no music is playing
  if (activeAudioInstances.size === 0) {
    return new Map()
  }
  
  const result = new Map()
  
  // Build lookup map once instead of .find() per audio instance
  const playerMap = new Map<string, { position: { x: number; z: number }; isMusicPlaying?: boolean; isYouTubePlaying?: boolean }>()
  for (const p of remotePlayers) {
    playerMap.set(p.id, p)
  }
  
  // Only iterate through players with active audio (much more efficient)
  activeAudioInstances.forEach((audio, key) => {
    // YouTube ghost audio keys are __youtube_${playerId}__, skin music keys are just playerId
    const isYouTubeKey = key.startsWith('__youtube_') && key.endsWith('__')
    const playerId = isYouTubeKey ? key.slice('__youtube_'.length, -2) : key
    
    const player = playerMap.get(playerId)
    if (!player || !player.position) return
    
    // Skin music or YouTube music — either is valid
    const hasActiveAudio = isYouTubeKey ? player.isYouTubePlaying : player.isMusicPlaying
    if (hasActiveAudio) {
      result.set(key, {
        audio,
        position: { x: player.position.x, z: player.position.z }
      })
    }
  })
  
  return result
}
