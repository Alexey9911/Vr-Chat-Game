// Pure distance + linear-falloff math, shared by the netcode (distance-tiered send rate) and proximity audio.
// Ported from GTA-PORT src/audio/spatial.ts (which was itself ported FROM alonHouse). Generic: callers pass
// their own radii, so the same curve drives both the broadcast rate and the voice/music gain.

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** Straight-line distance between two points. */
export function distance3D(a: Vec3Like, b: Vec3Like): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Linear distance→value falloff, clamped to `[0, maxValue]`:
 *  - `distance ≤ fullDistance` → `maxValue`
 *  - `distance ≥ maxDistance`  → `0` (also for non-finite distance — e.g. "no neighbour")
 *  - in between → linear ramp.
 */
export function falloff(distance: number, maxDistance: number, maxValue: number, fullDistance = 0): number {
  if (!Number.isFinite(distance) || distance >= maxDistance) {
    return 0;
  }
  if (distance <= fullDistance) {
    return maxValue;
  }
  const span = maxDistance - fullDistance;
  const ratio = 1 - (distance - fullDistance) / span;

  return Math.max(0, Math.min(maxValue, ratio * maxValue));
}
