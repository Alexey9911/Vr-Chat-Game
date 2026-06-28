// Snapshot interpolation for remote players. Each remote keeps a short time-stamped buffer of received
// broadcasts; the renderer samples it slightly in the PAST (now − delay) and interpolates between the two
// bracketing snapshots, so bunched/jittery packets don't cause position jumps. Ported from GTA-PORT
// src/game/net/interpolation.ts (facing→rotationY for alonHouse's Y-up R3F). Used in Phase 3 by the inbound
// seam that drives `updateRemotePlayer`.

export interface Snapshot {
  /** Receive time (performance.now(), ms). */
  t: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

/** Shortest-path interpolation between two yaw angles (handles the ±π wrap). */
export function lerpAngle(a: number, b: number, alpha: number): number {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  } else if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }

  return a + delta * alpha;
}

/** Append a snapshot and drop any older than `maxAgeMs` before the newest (keeps a 2-entry floor). */
export function pushSnapshot(buffer: Snapshot[], snap: Snapshot, maxAgeMs = 1000): void {
  buffer.push(snap);
  const cutoff = snap.t - maxAgeMs;
  while (buffer.length > 2 && buffer[0].t < cutoff) {
    buffer.shift();
  }
}

/**
 * The render delay (ms) for a remote, sized from its observed inter-snapshot `gap`, eased from `prev` (EMA).
 * A slow sender (a far player throttled by the distance-tiered rate) gets a LONGER delay so render time still
 * falls BETWEEN two buffered snapshots — smooth interpolation instead of clamp-and-jump — while a full-rate
 * (close) sender stays at the tight `base`. Capped at `max` so a one-off packet-loss gap can't over-delay it.
 */
export function adaptiveInterpDelay(prev: number, gap: number, base: number, max: number): number {
  const target = Math.min(max, Math.max(base, gap * 1.5));

  return prev + (target - prev) * 0.4;
}

/**
 * Sample the buffer at `renderTime` (ms): interpolate between the two bracketing snapshots, clamped to the ends
 * (no extrapolation). Returns `null` only for an empty buffer.
 */
export function sampleSnapshot(buffer: readonly Snapshot[], renderTime: number): null | Snapshot {
  const n = buffer.length;
  if (n === 0) {
    return null;
  }
  if (renderTime <= buffer[0].t) {
    return buffer[0];
  }
  const newest = buffer[n - 1];
  if (renderTime >= newest.t) {
    return newest;
  }
  let i = 1;
  while (i < n && buffer[i].t < renderTime) {
    i += 1;
  }
  const before = buffer[i - 1];
  const after = buffer[i];
  const span = after.t - before.t;
  const alpha = span > 1e-4 ? (renderTime - before.t) / span : 0;

  return {
    rotationY: lerpAngle(before.rotationY, after.rotationY, alpha),
    t: renderTime,
    x: before.x + (after.x - before.x) * alpha,
    y: before.y + (after.y - before.y) * alpha,
    z: before.z + (after.z - before.z) * alpha,
  };
}
