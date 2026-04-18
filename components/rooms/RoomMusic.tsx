import React, { useEffect, useRef } from 'react'
import { PositionalAudio } from '@react-three/drei'
import * as THREE from 'three'
import { ROOM_Y_OFFSET } from '../../lib/roomsConfig'
import { useZoneStore } from '../../lib/zoneStore'
import { AUDIO_VOLUME, getGlobalVolumeMultiplier } from '../../lib/audio/musicSystem'

// Looped spatial music per room. Each track's plane center comes from a
// dedicated `*_music_plane.glb` in `public/alon_house/` (extracted offline
// via the node JSON-chunk one-liner — see nuevo_alon_house.md).
//
// Audio model: we force `distanceModel = 'linear'` on the underlying
// PannerNode via `audio.getOutput()` because drei's <PositionalAudio>
// only forwards `refDistance` via its `distance` prop — `maxDistance` and
// `distanceModel` as JSX props are silently dropped, which left us with
// three.js' default "inverse" model (infinite tail) and audio bleeding
// across the whole map.
//
// Play/pause gate: `useZoneStore.currentZone === 'interior'`. Single zone
// flag → no extra store. Pause (not stop) so re-entering resumes.
type Track = {
  id: string
  url: string
  centerBlender: [number, number, number]
  refDistance: number  // full volume radius
  maxDistance: number  // hard silence radius (linear model)
}

const TRACKS: Track[] = [
  {
    id: 'indian',
    // Indian room is more elongated than jewish. PannerNode uses a
    // SPHERICAL falloff (no ellipsoid), so to cover the long ends we
    // just enlarge the sphere — bigger refDistance + maxDistance than
    // jewish, even though the Blender plane scale is the same.
    url: '/alon_house/rooms/indianmusic.mp3',
    centerBlender: [-41.97, 337.35, 173.54],
    refDistance: 45,
    maxDistance: 115,
  },
  {
    id: 'jewish',
    url: '/alon_house/rooms/jewishmusic.mp3',
    centerBlender: [-68.08, 337.35, 11.61],
    refDistance: 25,
    maxDistance: 70,
  },
]

const ROLLOFF = 1

function RoomTrack({ track }: { track: Track }) {
  const audioRef = useRef<any>(null)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return

    // Force linear distance model + our radii on the PannerNode directly.
    try {
      const panner = a.getOutput?.()
      if (panner && 'distanceModel' in panner) {
        panner.distanceModel = 'linear'
        panner.refDistance = track.refDistance
        panner.maxDistance = track.maxDistance
        panner.rolloffFactor = ROLLOFF
      }
    } catch (_) {}

    const apply = (zone: string) => {
      const shouldPlay = zone === 'interior'
      try {
        if (shouldPlay) {
          a.setVolume(AUDIO_VOLUME * getGlobalVolumeMultiplier())
          if (!a.isPlaying) a.play()
        } else if (a.isPlaying) {
          a.pause()
        }
      } catch (_) {}
    }

    apply(useZoneStore.getState().currentZone)
    const unsub = useZoneStore.subscribe((s) => apply(s.currentZone))
    return () => {
      unsub()
      try { audioRef.current?.stop?.() } catch (_) {}
    }
  }, [track.refDistance, track.maxDistance])

  const position = new THREE.Vector3(
    track.centerBlender[0],
    track.centerBlender[1] + ROOM_Y_OFFSET,
    track.centerBlender[2],
  )

  return (
    <PositionalAudio
      ref={audioRef}
      url={track.url}
      distance={track.refDistance}
      loop
      autoplay={false}
      position={position}
    />
  )
}

export default function RoomMusic() {
  return (
    <group>
      {TRACKS.map((t) => (
        <RoomTrack key={t.id} track={t} />
      ))}
    </group>
  )
}
