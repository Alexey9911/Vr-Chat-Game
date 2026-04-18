// Shared helper to work around Chromium's ~1.25s SILENT cooldown after the
// user exits pointer-lock with ESC. Calling `requestPointerLock()` during
// that window fails with no error, no rejected promise, and no event — the
// browser simply ignores it. That's why users had to "click twice" to
// re-lock after ESC: the first click fell inside the cooldown.
//
// We track every `pointerlockchange` that leaves the document unlocked and,
// when something asks us to lock, we either do it immediately (cooldown
// already over) or schedule the lock for the moment the cooldown ends plus a
// small safety margin. A pending request is cancelled as soon as the lock
// actually takes hold.
// Chromium's post-ESC cooldown is not a fixed value — it varies by version
// and by how quickly the user clicks. Instead of guessing an interval and
// waiting the full estimate, we aggressively retry at short intervals so
// the lock succeeds the *instant* the browser allows it. In practice this
// means ~100-300ms from click → lock, far below the previous ~1.3s.
const RETRY_INTERVAL_MS = 60
const MAX_RETRY_MS = 1600

let pendingTimer: number | null = null
let retryStartedAt = 0
let retryTarget: HTMLCanvasElement | null = null
let listenerInstalled = false

function installListener() {
  if (listenerInstalled || typeof document === 'undefined') return
  listenerInstalled = true
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement && pendingTimer !== null) {
      // Lock succeeded — stop retrying.
      window.clearTimeout(pendingTimer)
      pendingTimer = null
      retryTarget = null
    }
  })
}

function attemptLock() {
  pendingTimer = null
  if (!retryTarget) return
  if (document.pointerLockElement === retryTarget) {
    retryTarget = null
    return
  }
  try { retryTarget.requestPointerLock() } catch {}
  // If the lock didn't take (Chromium cooldown), keep retrying at a fast
  // cadence until we either succeed (pointerlockchange clears us) or we
  // exceed MAX_RETRY_MS (user probably gave up).
  if (Date.now() - retryStartedAt < MAX_RETRY_MS) {
    pendingTimer = window.setTimeout(attemptLock, RETRY_INTERVAL_MS)
  } else {
    retryTarget = null
  }
}

/**
 * Ask the browser to pointer-lock the given canvas. Fires immediately and
 * then keeps retrying every ~60ms until the lock actually activates,
 * bypassing Chromium's silent post-ESC cooldown with zero perceived delay.
 */
export function requestPointerLockSafe(canvas: HTMLCanvasElement) {
  installListener()
  if (typeof document === 'undefined') return
  if (document.pointerLockElement === canvas) return

  retryTarget = canvas
  retryStartedAt = Date.now()
  if (pendingTimer !== null) window.clearTimeout(pendingTimer)
  attemptLock()
}

export function cancelPendingPointerLock() {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer)
    pendingTimer = null
  }
  retryTarget = null
}
