import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, Raycaster } from 'three'
import { useKeyboardStore } from '../lib/useKeyboardStore'
import { useMultiplayerStore } from '../lib/multiplayerStore'
import { EYE_HEIGHT } from '../lib/camera/cameraConstants'
import { useViewStore } from '../lib/camera/viewStore'
import { useSkinStore } from '../lib/skins/skinStore'
import { compressPosition, compressRotation } from './usePositionSync'
import { setLocalPlayerLive } from '../lib/localPlayerRef'
import { getHouseCollisionMesh, getCollisionMeshes } from '../lib/collisionRef'
import { setTeleportFunction } from '../lib/teleportController'
import { requestPointerLockSafe, cancelPendingPointerLock } from '../lib/pointerLockHelper'
import { useZoneStore } from '../lib/zoneStore'
import { ROOM_Y_OFFSET, ROOM_FLOOR_BLENDER_Y } from '../lib/roomsConfig'
import { getSkinEmoteClipMap } from '../lib/skins/skinAnimations'
import { isGeckos } from '../lib/net/netClient'

// Physics constants
const GRAVITY = -35
const JUMP_FORCE = 16
// Max vertical obstacle the player will auto-climb (stair treads, curbs).
// Anything taller registers as a wall and blocks movement normally.
const STEP_HEIGHT = 2.5
// Reused down vector for the ground / step-up probes.
const DOWN_VEC = new Vector3(0, -1, 0)

// Camera orbit constants
const CAM_DIST = 20                // distance from player to camera
const CAM_MIN_PITCH = 0.05        // ~3° above horizontal (nearly level)
const CAM_MAX_PITCH = 1.35        // ~77° (nearly top-down)
const CAM_INITIAL_PITCH = 0.32    // ~18° — comfortable default
const MOUSE_SENSITIVITY = 0.003
const CAM_COLLISION_OFFSET = 0.5   // stop camera this far before wall
const CAM_COLLISION_MIN = 1.0      // never closer than this to player
const CAM_LOOK_HEIGHT = 2.5       // look-at point above player feet

export const useCameraControls = () => {
  const { camera, gl } = useThree()
  const { addPressedKey, removePressedKey, setPressedKeys, isKeyPressed, chatActive, setCurrentAnimation } = useKeyboardStore()
  const cinematicMode = useViewStore((s) => s.cinematicMode)
  const toggleCinematicMode = useViewStore((s) => s.toggleCinematicMode)
  const activeSkinId = useSkinStore((s) => s.activeSkinId)
  const lobbyVisible = useMultiplayerStore((s) => s.lobbyVisible)
  
  // Movement parameters
  const moveSpeed = useRef(12.5)
  
  // Camera state - Initial spawn position
  const SPAWN_X = -200.58
  const SPAWN_Z = -139.71
  // SPAWN_ROT_DISPLAY is what shows in PositionDebug HUD
  // Internal quaternion angle = display angle + 180° (offset from atan2 convention)
  const SPAWN_ROT_DISPLAY = 50.65 // degrees shown in HUD
  const SPAWN_ROT = (SPAWN_ROT_DISPLAY + 180) * (Math.PI / 180)
  
  const playerPos = useRef(new Vector3(SPAWN_X, EYE_HEIGHT, SPAWN_Z))
  const velocity = useRef(new Vector3())
  const lastSafePos = useRef(new Vector3(SPAWN_X, EYE_HEIGHT, SPAWN_Z))

  // Mouse orbit state — yaw controls where the camera orbits, pitch controls height
  // orbitYaw = angle where camera sits relative to player (same convention as old SPAWN_ROT)
  // targetYaw/Pitch receive mouse input directly; orbitYaw/Pitch smoothly follow them
  // to prevent fast flicks from sweeping the collision raycast through walls.
  const orbitYaw = useRef(SPAWN_ROT)
  const orbitPitch = useRef(CAM_INITIAL_PITCH)
  const targetYaw = useRef(SPAWN_ROT)
  const targetPitch = useRef(CAM_INITIAL_PITCH)
  // playerFacingY = direction the character model faces (matches old liveRotY convention)
  const initFacing = Math.atan2(-Math.sin(SPAWN_ROT), -Math.cos(SPAWN_ROT))
  const playerFacingY = useRef(initFacing)

  // Jump physics
  const velocityY = useRef(0)        // vertical velocity
  const isOnGround = useRef(true)   // is character touching ground?
  const spaceWasDown = useRef(false) // to detect rising edge of space key

  // Multiplayer sync counter
  const syncCounter = useRef(0)
  const playroomRef = useRef<any>(null)
  
  // Position throttling for network optimization
  const lastSentPos = useRef(new Vector3(SPAWN_X, EYE_HEIGHT, SPAWN_Z))
  const lastSentRotY = useRef(initFacing)
  // Last movement animation pushed to Playroom ('Sprint' | 'Run' | null).
  // We only setState when the value transitions to avoid network spam —
  // idle → run → sprint flips are rare compared to the per-frame position
  // updates. Emotes (currentEmote.current) always take priority, so while
  // an emote is active we don't touch this.
  const lastSentMoveAnim = useRef<string | null>(null)
  const POSITION_THRESHOLD = 0.08 // Only sync if moved >8cm
  const ROTATION_THRESHOLD = 0.04 // Only sync if rotated >2.3 degrees
  
  // Custom animation state override
  const currentEmote = useRef<string | null>(null)
  
  // Collision detection — separate raycasters for movement, ground, and camera
  const moveRaycaster = useRef(new Raycaster())
  const groundRaycaster = useRef(new Raycaster())
  const camRaycaster = useRef(new Raycaster())
  // Smoothed radial distance — snap inward to prevent wall clipping,
  // lerp outward so transient collision hits (fast orbit) don't cause zoom flicker.
  const smoothedCamDist = useRef(CAM_DIST)

  // Cinematic mode is now managed by useViewStore (toggled via F9)
  // The free-fly camera is handled by CinematicCamera.tsx component
  
  // Teleport flag — skips validation for one frame after teleport
  const isTeleporting = useRef(false)
  
  // Teleport function for checkpoints
  const teleport = useCallback((pos: Vector3, rotY: number) => {
    isTeleporting.current = true
    
    playerPos.current.copy(pos)
    lastSafePos.current.copy(pos)
    
    // Set orbit yaw to match teleport rotation so camera ends up behind the player
    orbitYaw.current = rotY
    targetYaw.current = rotY
    targetPitch.current = orbitPitch.current
    playerFacingY.current = Math.atan2(-Math.sin(rotY), -Math.cos(rotY))
    
    // Compute camera position immediately to avoid lerp jump
    const pitch = orbitPitch.current
    const lookAt = new Vector3(pos.x, pos.y + CAM_LOOK_HEIGHT, pos.z)
    const camOffset = new Vector3(
      Math.sin(rotY) * Math.cos(pitch) * CAM_DIST,
      Math.sin(pitch) * CAM_DIST,
      Math.cos(rotY) * Math.cos(pitch) * CAM_DIST,
    )
    camera.position.copy(lookAt).add(camOffset)
    camera.lookAt(lookAt)
    
    // Reset velocity and ground state
    velocity.current.set(0, 0, 0)
    velocityY.current = 0
    isOnGround.current = true
    
    // Clear teleporting flag after a frame
    requestAnimationFrame(() => { isTeleporting.current = false })
  }, [camera])

  // Initialize position with spawn values
  useEffect(() => {
    playerPos.current.set(SPAWN_X, EYE_HEIGHT, SPAWN_Z)
    lastSafePos.current.copy(playerPos.current)
    orbitYaw.current = SPAWN_ROT
    targetYaw.current = SPAWN_ROT
    targetPitch.current = CAM_INITIAL_PITCH
    playerFacingY.current = initFacing
    
    // Position camera at orbit location immediately
    const pitch = orbitPitch.current
    const lookAt = new Vector3(SPAWN_X, EYE_HEIGHT + CAM_LOOK_HEIGHT, SPAWN_Z)
    const camOffset = new Vector3(
      Math.sin(SPAWN_ROT) * Math.cos(pitch) * CAM_DIST,
      Math.sin(pitch) * CAM_DIST,
      Math.cos(SPAWN_ROT) * Math.cos(pitch) * CAM_DIST,
    )
    camera.position.copy(lookAt).add(camOffset)
    camera.lookAt(lookAt)
    
    // Register teleport function for checkpoints
    setTeleportFunction(teleport)
  }, [camera, teleport])

  // =============================================
  // DYNAMIC CAMERA FAR — drop the far plane hard when the player enters
  // an interior room so Three.js can frustum-cull the entire exterior
  // (house, garden, street, cars, NPCs, airdrops, …) for free. The
  // swap happens during the checkpoint fade — the screen is black, so
  // there is no visible pop even though the projection matrix changes.
  // Values:
  //   exterior / balcon → 350  (same as before, sees the whole plot)
  //   interior          → 100  (rooms are tiny, 100 is plenty)
  // =============================================
  useEffect(() => {
    const applyFar = (zone: 'exterior' | 'interior' | 'balcon') => {
      const far = zone === 'interior' ? 250 : 350
      if ((camera as any).far !== far) {
        ;(camera as any).far = far
        ;(camera as any).updateProjectionMatrix?.()
      }
    }
    // Apply for the current zone on mount.
    applyFar(useZoneStore.getState().currentZone)
    // And on every zone change. The zoneStore flips `currentZone` exactly
    // at teleport time (mid fade-out), giving us the black frame to mask
    // the projection swap.
    const unsub = useZoneStore.subscribe((state) => applyFar(state.currentZone))
    return () => unsub()
  }, [camera])

  // =============================================
  // MOUSE ORBIT — pointer lock on click, mousemove updates orbit angles
  // =============================================
  useEffect(() => {
    const canvas = gl.domElement
    
    const onMouseMove = (e: MouseEvent) => {
      // Only orbit when pointer is locked to the canvas
      if (document.pointerLockElement !== canvas) return
      if (cinematicMode) return
      
      // Clamp movement deltas — browsers/pointer-lock can emit huge values
      // on fast flicks (mouse acceleration).
      const MAX_DELTA = 120 // pixels per event
      const dx = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, e.movementX))
      const dy = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, e.movementY))
      
      // Write to target; orbit values lerp toward these in useFrame so the
      // collision raycast never sweeps through walls in a single step.
      targetYaw.current -= dx * MOUSE_SENSITIVITY
      targetPitch.current = Math.max(
        CAM_MIN_PITCH,
        Math.min(CAM_MAX_PITCH, targetPitch.current + dy * MOUSE_SENSITIVITY)
      )
    }
    
    // Pointer-lock on click, via the shared helper that handles Chromium's
    // silent post-ESC cooldown so one click is always enough.
    const onClick = () => {
      // Read from getState() to avoid stale closures after Alt+Tab / focus loss
      if (useKeyboardStore.getState().chatActive || useMultiplayerStore.getState().lobbyVisible || cinematicMode) return
      requestPointerLockSafe(canvas)
    }
    canvas.addEventListener('click', onClick)
    document.addEventListener('mousemove', onMouseMove)

    // =============================================
    // TOUCH ORBIT — single-finger drag rotates the camera (mobile only).
    // Two-finger gestures (pinch zoom) are ignored here so the browser's
    // default behaviour or any future zoom handler can claim them.
    // We anchor to the last touch position rather than using movementX/Y
    // because TouchEvent has no such field.
    // =============================================
    let lastTouchX = 0
    let lastTouchY = 0
    let tracking = false
    const TOUCH_SENSITIVITY = MOUSE_SENSITIVITY * 1.3 // slightly punchier on phones
    const onTouchStart = (e: TouchEvent) => {
      if (useKeyboardStore.getState().chatActive || useMultiplayerStore.getState().lobbyVisible || cinematicMode) return
      if (e.touches.length !== 1) { tracking = false; return }
      // Ignore touches that originated on UI elements (buttons, bars, etc.)
      const t = e.touches[0]
      const target = e.target as HTMLElement | null
      if (target && target !== canvas) return
      lastTouchX = t.clientX
      lastTouchY = t.clientY
      tracking = true
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return
      if (e.touches.length !== 1) { tracking = false; return }
      if (useKeyboardStore.getState().chatActive || useMultiplayerStore.getState().lobbyVisible || cinematicMode) return
      const t = e.touches[0]
      const dx = t.clientX - lastTouchX
      const dy = t.clientY - lastTouchY
      lastTouchX = t.clientX
      lastTouchY = t.clientY
      // Prevent page scroll while dragging on the canvas.
      if (e.cancelable) e.preventDefault()
      targetYaw.current -= dx * TOUCH_SENSITIVITY
      targetPitch.current = Math.max(
        CAM_MIN_PITCH,
        Math.min(CAM_MAX_PITCH, targetPitch.current + dy * TOUCH_SENSITIVITY)
      )
    }
    const onTouchEnd = () => { tracking = false }
    // `passive: false` is required so preventDefault works in onTouchMove
    // (Chrome made touchmove passive-by-default some versions ago).
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false })
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: true })
    canvas.addEventListener('touchcancel', onTouchEnd,  { passive: true })

    return () => {
      canvas.removeEventListener('click', onClick)
      cancelPendingPointerLock()
      document.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove',  onTouchMove)
      canvas.removeEventListener('touchend',   onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [gl, cinematicMode])

  // Release pointer lock when chat or lobby opens
  useEffect(() => {
    if ((chatActive || lobbyVisible) && document.pointerLockElement) {
      document.exitPointerLock()
    }
  }, [chatActive, lobbyVisible])

  // Load PlayroomKit dynamically
  useEffect(() => {
    // @ts-ignore — playroomkit will be available after npm install
    import('playroomkit').then((mod: any) => {
      playroomRef.current = mod
    }).catch(() => {
      // Not installed yet, will work after npm install
    })
  }, [])

  // Memoizar los handlers para evitar recreaciones
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const el = document.activeElement as any
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    // Read from getState() to avoid stale closures after Alt+Tab / focus loss
    const isChatActive = useKeyboardStore.getState().chatActive
    const isLobbyOpen = useMultiplayerStore.getState().lobbyVisible
    if (typing || isChatActive || isLobbyOpen) return

    const key = event.key.toLowerCase()
    // F9: Toggle cinematic free camera (handled by CinematicCamera.tsx)
    if (event.key === 'F9') {
      event.preventDefault()
      toggleCinematicMode()
      return
    }
    if (['w', 'a', 's', 'd', 'e', 'q', '1', '2', '3', '4', '5', '6', '7', '8'].includes(key)) {
      if (['w', 'a', 's', 'd', 'e', 'q'].includes(key)) {
        event.preventDefault()
      }
      addPressedKey(key)
    }
    // Shift key for cinematic sprint
    if (event.key === 'Shift') {
      addPressedKey('shift')
    }
    // Space: track for jump (prevent page scroll)
    if (event.code === 'Space') {
      event.preventDefault()
      addPressedKey(' ')
    }

    // EMOTES (Number keys) — fully data-driven from the central skin-animation
    // config. Each skin's `emotes[]` maps key '2'.. → raw GLB clip name. Skins
    // with no emotes (the animal skins: bull/popcat) get an empty map, so the
    // number keys simply do nothing for them.
    const animMap = getSkinEmoteClipMap(activeSkinId)

    if (animMap[key] && (isGeckos() || playroomRef.current?.myPlayer?.())) {
      currentEmote.current = animMap[key]
      setCurrentAnimation(animMap[key])
      if (!isGeckos()) playroomRef.current.myPlayer().setState('animation', animMap[key], true)

      // Update local player in store so their own avatar animates (geckos also broadcasts it via the StateGetter).
      const { localPlayerId, updateRemotePlayer } = useMultiplayerStore.getState()
      if (localPlayerId) {
        updateRemotePlayer(localPlayerId, { animation: animMap[key] })
      }
    }

  }, [addPressedKey, setCurrentAnimation, activeSkinId])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const el = document.activeElement as any
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    // Read from getState() to avoid stale closures after Alt+Tab / focus loss
    if (typing || useKeyboardStore.getState().chatActive) return

    const key = event.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'e', 'q', '1', '2', '3', '4', '5', '6', '7', '8'].includes(key)) {
      if (['w', 'a', 's', 'd', 'e', 'q'].includes(key)) {
        event.preventDefault()
      }
      removePressedKey(key)
    }
    if (event.key === 'Shift') {
      removePressedKey('shift')
    }
    if (event.code === 'Space') {
      event.preventDefault()
      removePressedKey(' ')
    }
  }, [removePressedKey])

  useEffect(() => {
    // Clear pressed keys only when focus moves to a REAL text input
    // (chat box, nickname field, etc.). Previously we cleared on ANY focus
    // change, which wiped W/A/S/D the moment a mobile user tapped a
    // TouchControls arrow button (buttons take focus on tap → focusin →
    const clear = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const tag = target.tagName
      const isRealInput = tag === 'INPUT' || tag === 'TEXTAREA' || (target as any).isContentEditable
      if (isRealInput) setPressedKeys(new Set())
    }
    window.addEventListener('focusin', clear, true)
    window.addEventListener('focusout', clear, true)
    return () => {
      window.removeEventListener('focusin', clear, true)
      window.removeEventListener('focusout', clear, true)
    }
  }, [setPressedKeys])

  // =============================================
  // TAB KEY + WINDOW BLUR GUARD
  //
  // Root cause of the "se bugea si tabuleo / ESC se queda pegado" report:
  //   1. User presses Tab while playing → browser's default focus nav moves
  //      focus to the first focusable element (a HUD button like the ESC /
  //      cursor toggle).
  //   2. With that button focused, Space/Enter click the button instead of
  //      jumping, and the whole cursor-lock ↔ UI state falls out of sync.
  //   3. Alt+Tabbing out of the window silently releases pointer-lock and
  //      leaves WASD "stuck" (keyup never fires while the tab is blurred).
  //
  // We fix both by:
  //   a) Intercepting Tab at the window level during gameplay (not typing /
  //      chat / lobby) — preventDefault + blur any currently-focused HUD
  //      element so focus returns to <body>. HUD buttons can still be
  //      clicked with the mouse; Tab simply never navigates to them.
  //   b) Clearing pressedKeys + resetting cursorIntent on window blur /
  //      document-hidden so no key stays "down" when the user comes back.
  // =============================================
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const el = document.activeElement as any
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing) return
      if (useKeyboardStore.getState().chatActive) return
      if (useMultiplayerStore.getState().lobbyVisible) return
      e.preventDefault()
      // Blur whichever HUD element may already be focused so subsequent
      // Space / Enter / ESC events don't "click" a hidden sticky button.
      if (el && typeof el.blur === 'function' && el !== document.body) {
        try { el.blur() } catch {}
      }
    }

    const onBlur = () => {
      // Player alt-tabbed / switched window. Browser already released the
      // pointer-lock; we just need to stop treating WASD as held.
      setPressedKeys(new Set())
      // Next pointer-lock release should be treated as a fresh, user-driven
      // event — previous `intentionalUnlock` state is now stale.
      import('../lib/cursorIntent').then(({ cursorIntent }) => {
        cursorIntent.intentionalUnlock = false
      }).catch(() => {})
    }

    const onVisibility = () => {
      if (document.hidden) onBlur()
    }

    // Defensive reset when the window REGAINS focus (Alt+Tab back, click
    // back from another app on ultra-wide, etc.). Blur any HUD element that
    // kept focus across the switch so handleKeyDown never early-returns due
    // to a stale activeElement, and wipe pressedKeys for good measure.
    const onFocus = () => {
      const el = document.activeElement as HTMLElement | null
      if (el && el !== document.body && typeof el.blur === 'function') {
        const tag = el.tagName
        const isRealInput = tag === 'INPUT' || tag === 'TEXTAREA' || (el as any).isContentEditable
        if (!isRealInput) {
          try { el.blur() } catch {}
        }
      }
      setPressedKeys(new Set())
      import('../lib/cursorIntent').then(({ cursorIntent }) => {
        cursorIntent.intentionalUnlock = false
      }).catch(() => {})
    }

    // =============================================
    // POINTER-LOCK RE-ACQUIRE GUARD
    //
    // Edge case reported on ultra-wide monitors: the user never Alt+Tabs,
    // they just click OUT of the browser onto another app running on the
    // same screen, then click back onto the canvas. Camera works (pointer
    // lock succeeds) but WASD is dead.
    //
    // Root cause: when focus left the browser, `window.blur` cleared
    // pressedKeys correctly, but `document.activeElement` was left on
    // whatever HUD button / element had focus at the moment of the switch
    // (clicking the canvas does NOT move focus — the canvas is not
    // focusable). The handleKeyDown early-return (`typing || chatActive
    // || lobbyVisible`) is narrow enough on paper, but the stuck focus +
    // any stale `cursorIntent` / `chatActive` race was leaving WASD
    // unresponsive on the first click back.
    //
    // Fix: every time pointer-lock is (re)acquired on OUR canvas, run the
    // same defensive reset as `onBlur` — blur any focused HUD element so
    // focus returns to <body>, wipe pressedKeys, and reset cursorIntent.
    // This is the exact mirror of the Tab / Alt-Tab guard above, but for
    // the "click-away-to-another-app" return path.
    // =============================================
    const onPointerLockChange = () => {
      const canvas = gl.domElement
      if (document.pointerLockElement !== canvas) return
      const el = document.activeElement as HTMLElement | null
      if (el && el !== document.body && typeof el.blur === 'function') {
        const tag = el.tagName
        const isRealInput = tag === 'INPUT' || tag === 'TEXTAREA' || (el as any).isContentEditable
        if (!isRealInput) {
          try { el.blur() } catch {}
        }
      }
      setPressedKeys(new Set())
      import('../lib/cursorIntent').then(({ cursorIntent }) => {
        cursorIntent.intentionalUnlock = false
      }).catch(() => {})
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
    }
  }, [setPressedKeys, gl])

  // Keyboard event handlers
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  useFrame((state, delta) => {
    // Cinematic free camera — handled by CinematicCamera.tsx, skip normal controls
    if (cinematicMode) return

    // Block movement while chat is active
    if (chatActive) return

    // =============================================
    // SMOOTH ORBIT — lerp current yaw/pitch toward targets set by mouse input.
    // This caps angular velocity so the camera collision raycast can't sweep
    // through walls on a single fast flick, preventing the "zoom to center" bug.
    // =============================================
    {
      let yawDiff = targetYaw.current - orbitYaw.current
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2
      const pitchDiff = targetPitch.current - orbitPitch.current
      // Exponential smoothing — very responsive but caps single-frame angular jump.
      // Higher factor = snappier (less smoothing). 25 feels near-instant at normal speeds.
      const k = 1 - Math.exp(-25 * delta)
      orbitYaw.current += yawDiff * k
      orbitPitch.current += pitchDiff * k
    }

    // =============================================
    // MOVEMENT — WASD relative to camera yaw (standard 3rd person)
    // W/S = forward/backward in camera direction, A/D = strafe left/right
    // =============================================
    velocity.current.set(0, 0, 0)
    
    const yaw = orbitYaw.current
    // Forward = direction from camera toward player (projected horizontal)
    const forward = new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
    // Right = perpendicular to forward on XZ plane
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
    
    // SHIFT held while moving = sprint (1.75× speed). Matches the Sprint
    // animation clip that RemotePlayerAvatar / avatar components play.
    const sprinting = isKeyPressed('shift')
    const speed = moveSpeed.current * delta * 1.6 * (sprinting ? 1.45 : 1)
    if (isKeyPressed('w')) velocity.current.add(forward.clone().multiplyScalar(speed))
    if (isKeyPressed('s')) velocity.current.add(forward.clone().multiplyScalar(-speed))
    if (isKeyPressed('a')) velocity.current.add(right.clone().multiplyScalar(-speed))
    if (isKeyPressed('d')) velocity.current.add(right.clone().multiplyScalar(speed))
    
    // Update player facing direction when moving (character turns smoothly toward movement)
    if (velocity.current.lengthSq() > 0.001) {
      const targetFacing = Math.atan2(velocity.current.x, velocity.current.z)
      // Compute shortest angular difference (handles -PI/+PI wrap)
      let diff = targetFacing - playerFacingY.current
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      // Smooth rotation: ~12 rad/s max turn speed, frame-rate independent
      const turnSpeed = 12
      const maxStep = turnSpeed * delta
      const step = Math.max(-maxStep, Math.min(maxStep, diff))
      playerFacingY.current += step
      // Wrap to [-PI, PI]
      if (playerFacingY.current > Math.PI) playerFacingY.current -= Math.PI * 2
      if (playerFacingY.current < -Math.PI) playerFacingY.current += Math.PI * 2
    }
    
    // =============================================
    // JUMP PHYSICS — Spacebar
    // =============================================
    // Check if space is currently held (using native API for rise-edge detection)
    const spaceDown = isKeyPressed(' ') || 
      // Fallback: check if the key physical state is pressed
      (window as any).__spaceDown === true

    // Detect leading edge: space pressed this frame, wasn't last frame
    if (spaceDown && !spaceWasDown.current && isOnGround.current) {
      velocityY.current = JUMP_FORCE  // launch upward
      isOnGround.current = false
    }
    spaceWasDown.current = spaceDown

    // Apply gravity every frame
    velocityY.current += GRAVITY * delta

    // Move player vertically
    playerPos.current.y += velocityY.current * delta

    // Ground check — zone-aware floor height.
    // Interior: downward raycast onto the physics meshes so ramps and
    //           stairs "just work" (the floor under the player tells us
    //           where to clamp, not a hardcoded Y). Falls back to the
    //           reference-plane Y if the probe misses (safety net so
    //           the player never falls into the void).
    // Exterior: simple EYE_HEIGHT clamp (flat ground handled by the
    //           terrain collision mesh separately).
    const currentZone = useZoneStore.getState().currentZone
    const collisionMeshes = getCollisionMeshes()
    // Balcony: fallback = Plane.011 center (Blender 32.48) + HouseScene.OY
    // + EYE_HEIGHT. The ground raycast will override this whenever it hits
    // the thickened balcony slab registered by HouseBalconyCollision.
    const fallbackFloorY = currentZone === 'interior'
      ? ROOM_FLOOR_BLENDER_Y + 1.1857 + ROOM_Y_OFFSET + EYE_HEIGHT
      : currentZone === 'balcon'
      ? 32.48 + 1.1857 + EYE_HEIGHT
      : EYE_HEIGHT

    let floorY = fallbackFloorY
    // Ground raycast in 'interior' OR 'balcon' — both rely on registered
    // collision meshes (rooms_physics / balcony Plane.011) to find the
    // floor dynamically. Exterior keeps its flat-ground fallback.
    if (currentZone !== 'exterior' && collisionMeshes.length > 0) {
      // Cast from ~STEP_HEIGHT above the player's eyes straight down.
      // Starting above the eye guarantees we hit floor geometry even
      // when the player is standing right on it.
      const origin = playerPos.current.clone()
      origin.y += 3
      groundRaycaster.current.set(origin, DOWN_VEC)
      groundRaycaster.current.far = 30
      const gHits = groundRaycaster.current.intersectObjects(collisionMeshes, false)
      if (gHits.length > 0) {
        floorY = gHits[0].point.y + EYE_HEIGHT
      } else if (currentZone === 'balcon') {
        // Player walked / jumped OFF the balcony slab — raycast misses,
        // which previously kept them clamped to fallbackFloorY (~36 Y),
        // creating the "suelo invisible" the user reported. Instead, we
        // treat them as exterior-ground-bound: floor = EYE_HEIGHT. Once
        // they land (or drop below a clear threshold) we also flip the
        // zone to 'exterior' so CP4 stops trying to teleport them.
        floorY = EYE_HEIGHT
        if (playerPos.current.y < 20 && !isTeleporting.current) {
          useZoneStore.getState().setZone('exterior')
        }
      }
    }

    if (playerPos.current.y <= floorY) {
      playerPos.current.y = floorY
      velocityY.current = 0
      isOnGround.current = true
    }

    // Apply lateral movement with collision detection.
    //
    // Iterative slide (Quake-style): a single hit-test per frame stops
    // the player dead at inside-corners (diagonal movement hits wall A,
    // slide redirects velocity along wall A, but that new velocity then
    // runs head-first into wall B — which we only notice NEXT frame, by
    // which point the player is already pressed into the corner and the
    // slide oscillates between the two walls → "me quedo atrapado en
    // las esquinas". Looping up to 4 times resolves multi-wall contacts
    // within the same frame so the player smoothly grazes a corner
    // instead of sticking to it.
    const MAX_SLIDE_ITERATIONS = 4
    let slideIter = 0
    while (
      slideIter < MAX_SLIDE_ITERATIONS &&
      velocity.current.lengthSq() > 0.001 &&
      collisionMeshes.length > 0
    ) {
      slideIter++
      const moveDir = velocity.current.clone().normalize()
      moveRaycaster.current.set(playerPos.current, moveDir)
      moveRaycaster.current.far = velocity.current.length() + 0.5

      const intersects = moveRaycaster.current.intersectObjects(collisionMeshes, false)

      if (!(intersects.length > 0 && intersects[0].distance < velocity.current.length() + 0.3)) {
        break // no obstacle — let the outer code move the player.
      }
      {
        const hit = intersects[0]

        // Step-up is ONLY valid while grounded. When airborne (jumping
        // into a wall) the old code would probe above the wall and snap
        // the player onto the wall top / ceiling — which is what caused
        // the "me bugeo y me quedo atorado" report. Skipping step-up
        // mid-air turns wall contact into a pure slide and gravity
        // handles the rest cleanly.
        let didStepUp = false
        if (isOnGround.current) {
          const probeOrigin = playerPos.current.clone()
            .add(moveDir.clone().multiplyScalar(hit.distance + 0.5))
          probeOrigin.y += STEP_HEIGHT // start above the potential step top
          groundRaycaster.current.set(probeOrigin, DOWN_VEC)
          groundRaycaster.current.far = STEP_HEIGHT * 2
          const stepHits = groundRaycaster.current.intersectObjects(collisionMeshes, false)

          const feetY = playerPos.current.y - EYE_HEIGHT
          const stepTopY = stepHits.length > 0 ? stepHits[0].point.y : -Infinity
          const stepHeight = stepTopY - feetY

          if (stepHits.length > 0 && stepHeight > 0 && stepHeight <= STEP_HEIGHT) {
            // Short obstacle — step over it instead of blocking.
            playerPos.current.y = stepTopY + EYE_HEIGHT
            velocityY.current = 0
            isOnGround.current = true
            didStepUp = true
          }
        }
        // Step-up resolved the obstacle vertically — skip the slide
        // branch and the rest of the iterative-slide loop (otherwise
        // the next iteration would re-hit the same step).
        if (didStepUp) break

        if (!didStepUp) {
          const normal = hit.face?.normal
          if (normal && hit.object) {
            const worldNormal = normal.clone().transformDirection((hit.object as any).matrixWorld)
            // Blender's `solidify` modifier produces inner + outer shells.
            // Depending on which face the ray hits first, worldNormal may
            // point IN THE SAME DIRECTION as the player's movement (i.e.
            // it's a back-face). Using it directly would slide the player
            // INTO the wall. Flip it so the normal always faces the ray
            // origin — the "coming-from" side of the contact.
            if (worldNormal.dot(moveDir) > 0) worldNormal.multiplyScalar(-1)

            // Slope / ramp handling: if the contact normal points
            // sufficiently upward, it's a walkable incline (a stair
            // authored as a ramp, a sloped path, CTRL+J'd geometry that
            // replaced discrete steps with a tilted face, …). Instead of
            // sliding off it like a wall, cast DOWN from a point just
            // past the hit to find where the ramp surface sits and snap
            // the player's Y onto it — same effect as step-up but works
            // for continuous slopes instead of discrete treads.
            const SLOPE_Y_MIN = 0.5 // ≈ up to 60° inclines count as walkable
            if (isOnGround.current && worldNormal.y >= SLOPE_Y_MIN) {
              const probeOrigin = playerPos.current.clone()
                .add(moveDir.clone().multiplyScalar(hit.distance + 0.5))
              probeOrigin.y += STEP_HEIGHT
              groundRaycaster.current.set(probeOrigin, DOWN_VEC)
              groundRaycaster.current.far = STEP_HEIGHT * 2
              const slopeHits = groundRaycaster.current.intersectObjects(collisionMeshes, false)
              const feetY = playerPos.current.y - EYE_HEIGHT
              if (slopeHits.length > 0) {
                const topY = slopeHits[0].point.y
                const dh = topY - feetY
                // Accept any rise within STEP_HEIGHT (going up) or any
                // drop (going down a ramp). Snap feet onto the surface.
                if (dh <= STEP_HEIGHT) {
                  playerPos.current.y = topY + EYE_HEIGHT
                  velocityY.current = 0
                  isOnGround.current = true
                  didStepUp = true
                }
              }
            }

            if (!didStepUp) {
              // Regular wall (or airborne contact) — slide along its
              // normal. Keep velocityY untouched so gravity / jump arc
              // are preserved while only the lateral component is
              // cancelled on the wall axis. The outer `while` will
              // re-test with the sliding velocity so a second wall in
              // the same frame (inside corner) also gets resolved
              // instead of sticking to it.
              const slideVel = velocity.current.clone().sub(
                worldNormal.clone().multiplyScalar(velocity.current.dot(worldNormal))
              )
              velocity.current.copy(slideVel.multiplyScalar(0.9))
            } else {
              // Slope climb handled vertically — no more lateral work
              // needed this frame.
              break
            }
          }
        }
      }
    }
    
    playerPos.current.add(velocity.current)

    // =============================================
    // DE-PENETRATION PASS — robust corner / hitbox recovery.
    //
    // The iterative slide above handles the common "sliding off a wall"
    // case but can still leave the player slightly INSIDE a collider
    // when they clip a sharp outside corner at high speed (e.g. the car
    // hitboxes): the forward-cast ray enters the box, the next ray from
    // inside it hits the opposite face with an inverted normal, and the
    // slide oscillates instead of pushing out.
    //
    // Fix: after committing this frame's movement, sweep 8 horizontal
    // rays around the player at torso height and push them OUT along
    // the surface normal of any face found closer than PLAYER_RADIUS.
    // This is a classic de-penetration step — cheap (8 short raycasts)
    // and effectively turns the player into a capsule for collision
    // recovery purposes without paying the cost of real capsule casts.
    if (collisionMeshes.length > 0) {
      const PLAYER_RADIUS = 0.9
      const probeY = playerPos.current.y - EYE_HEIGHT * 0.5
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        const dir = new Vector3(Math.cos(a), 0, Math.sin(a))
        const origin = new Vector3(playerPos.current.x, probeY, playerPos.current.z)
        moveRaycaster.current.set(origin, dir)
        moveRaycaster.current.far = PLAYER_RADIUS
        const hits = moveRaycaster.current.intersectObjects(collisionMeshes, false)
        if (hits.length === 0) continue
        const hit = hits[0]
        if (hit.distance >= PLAYER_RADIUS) continue
        const n = hit.face?.normal
        if (!n || !hit.object) continue
        const worldN = n.clone().transformDirection((hit.object as any).matrixWorld)
        // Flip so normal faces the player (ray origin).
        if (worldN.dot(dir) > 0) worldN.multiplyScalar(-1)
        const push = PLAYER_RADIUS - hit.distance
        playerPos.current.x += worldN.x * push
        playerPos.current.z += worldN.z * push
      }
    }

    // Sync movement animation ('Sprint' | 'Run' | null) to Playroom so
    // remote clients can render the correct clip. Only fires on state
    // transitions (idle↔run↔sprint). Skipped while an emote is active —
    // emotes own `setState('animation', ...)` until the player moves,
    // and the block below clears them.
    if (currentEmote.current === null) {
      const moving = velocity.current.lengthSq() > 0.001
      const desiredMoveAnim: string | null = moving ? (sprinting ? 'Sprint' : 'Run') : null
      if (desiredMoveAnim !== lastSentMoveAnim.current) {
        lastSentMoveAnim.current = desiredMoveAnim
        if (!isGeckos()) playroomRef.current?.myPlayer?.()?.setState('animation', desiredMoveAnim, true)
        // Store update drives the local avatar AND (geckos) the broadcast — runs for both transports.
        const { localPlayerId, updateRemotePlayer } = useMultiplayerStore.getState()
        if (localPlayerId) {
          updateRemotePlayer(localPlayerId, { animation: desiredMoveAnim })
        }
      }
    }

    // Clear emote if player starts moving
    if (velocity.current.lengthSq() > 0.001 && currentEmote.current !== null) {
      currentEmote.current = null
      setCurrentAnimation(null)
      if (!isGeckos()) playroomRef.current?.myPlayer?.()?.setState('animation', null, true)

      // Clear local player animation (geckos broadcasts the cleared clip too).
      const { localPlayerId, updateRemotePlayer } = useMultiplayerStore.getState()
      if (localPlayerId) {
        updateRemotePlayer(localPlayerId, { animation: null })
      }
    }

    // World boundaries (invisible wall) — zone-aware
    // Exterior has NO clamp — collisions are enforced by the exterior_calle_collision mesh (raycast above).
    if (currentZone === 'interior') {
      // Interior invisible-wall boundary — kept intentionally generous so
      // the new rooms_physics.glb (walls as planes) is the real authority
      // on collisions. The clamp only prevents runaway NaN positions.
      const xMin = -300, xMax = 300, zMin = -300, zMax = 300
      playerPos.current.x = Math.max(xMin, Math.min(xMax, playerPos.current.x))
      playerPos.current.z = Math.max(zMin, Math.min(zMax, playerPos.current.z))
    }

    // =============================================
    // CAMERA VALIDATION — prevents bad positions (NaN / huge jumps)
    // =============================================
    const pos = playerPos.current
    const isFinitePos = Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)
    if (!isFinitePos) {
      pos.set(lastSafePos.current.x, lastSafePos.current.y, lastSafePos.current.z)
    } else {
      const dx = pos.x - lastSafePos.current.x
      const dy = pos.y - lastSafePos.current.y
      const dz = pos.z - lastSafePos.current.z
      const maxStep = 3
      if (!isTeleporting.current && dx * dx + dy * dy + dz * dz > maxStep * maxStep) {
        pos.copy(lastSafePos.current)
      } else {
        lastSafePos.current.copy(pos)
      }
    }

    // Update live ref EVERY frame with full precision — RemotePlayerAvatar reads this
    // to keep the local player character model in sync without quantization wobble
    setLocalPlayerLive(playerPos.current.x, playerPos.current.y, playerPos.current.z, playerFacingY.current)

    // =============================================
    // THIRD-PERSON CAMERA — orbit position + collision avoidance
    // =============================================
    const pitch = orbitPitch.current
    
    // Look-at point (slightly above player feet)
    const lookAtPoint = new Vector3(
      playerPos.current.x,
      playerPos.current.y + CAM_LOOK_HEIGHT,
      playerPos.current.z
    )
    
    // Desired camera direction (unit vector from look-at to ideal camera position)
    const camDir = new Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    )

    // =============================================
    // CAMERA COLLISION — raycast along orbit direction.
    // We smooth the RADIAL DISTANCE (not full 3D position) so that:
    //   - Inward snap is instant → camera never clips walls
    //   - Outward recovery is smooth → transient ray misses during fast
    //     horizontal flicks don't cause the "zoom to center" flicker
    // =============================================
    let targetDist = CAM_DIST

    if (collisionMeshes.length > 0) {
      const rayOrigin = lookAtPoint.clone()
      camRaycaster.current.set(rayOrigin, camDir)
      camRaycaster.current.far = CAM_DIST
      camRaycaster.current.near = 0

      const hits = camRaycaster.current.intersectObjects(collisionMeshes, false)
      if (hits.length > 0 && hits[0].distance < CAM_DIST) {
        targetDist = Math.max(hits[0].distance - CAM_COLLISION_OFFSET, CAM_COLLISION_MIN)
      }
    }

    // Smooth radial distance.
    //
    // Previous tuning (kIn=30) felt brusque: the camera snapped inward
    // within ~100ms which reads as a jerky punch whenever you graze a
    // car / wall while running. Pro third-person games (Uncharted, GoW,
    // Horizon) keep the inward pull noticeably slower than an instant
    // snap — ~200-250ms to converge — and rely on a generous collision
    // offset to never clip through geometry in that window.
    //
    // New tuning:
    //   kIn  = 14  → ≈95% in ~210ms, silky instead of snappy.
    //   kOut = 5   → ≈95% in ~600ms, prevents flicker on orbit misses.
    // CAM_COLLISION_OFFSET already provides the safety buffer.
    if (targetDist < smoothedCamDist.current) {
      const kIn = 1 - Math.exp(-14 * delta)
      smoothedCamDist.current += (targetDist - smoothedCamDist.current) * kIn
    } else {
      const kOut = 1 - Math.exp(-5 * delta)
      smoothedCamDist.current += (targetDist - smoothedCamDist.current) * kOut
    }

    const finalCamPos = lookAtPoint.clone().add(camDir.multiplyScalar(smoothedCamDist.current))
    camera.position.copy(finalCamPos)
    camera.lookAt(lookAtPoint)

    // =============================================
    // MULTIPLAYER: Sync camera position with throttling (OPTIMIZED)
    // Only sends updates when position/rotation changes significantly
    // Reduces network traffic by 70-80% when idle
    // =============================================
    syncCounter.current++
    if (syncCounter.current % 3 === 0) {
      try {
        const geckos = isGeckos()
        const pk = geckos ? null : playroomRef.current
        const me = geckos ? null : pk?.myPlayer?.()
        // Playroom needs `me`; geckos broadcasts from the zustand echo below (no Playroom). Run when ready.
        if (geckos || me) {
          // Player facing direction for multiplayer
          const rotY = playerFacingY.current

          // Check if position or rotation changed significantly
          const dx = Math.abs(playerPos.current.x - lastSentPos.current.x)
          const dy = Math.abs(playerPos.current.y - lastSentPos.current.y)
          const dz = Math.abs(playerPos.current.z - lastSentPos.current.z)

          let rotDelta = Math.abs(rotY - lastSentRotY.current)
          if (rotDelta > Math.PI) rotDelta = Math.PI * 2 - rotDelta

          const posChanged = dx > POSITION_THRESHOLD || dy > POSITION_THRESHOLD || dz > POSITION_THRESHOLD
          const rotChanged = rotDelta > ROTATION_THRESHOLD

          // Only sync if something changed (or force sync every 60 frames ~1 sec)
          if (posChanged || rotChanged || syncCounter.current % 60 === 0) {
            // Compress data to reduce bandwidth
            const compressedPos = compressPosition({
              x: playerPos.current.x,
              y: playerPos.current.y,
              z: playerPos.current.z,
            })
            const compressedRotY = compressRotation(rotY)

            // Playroom path: write the per-player keyed state. (geckos broadcasts from the echo below.)
            if (me) {
              me.setState('pos', compressedPos, true)
              me.setState('rotY', compressedRotY, true)
            }

            lastSentPos.current.copy(playerPos.current)
            lastSentRotY.current = rotY

            // Echo into the local zustand entry. For geckos this IS the broadcast source (Presence pulls it
            // each tick via the StateGetter); for Playroom it keeps the LOCAL avatar rendering.
            const { localPlayerId, updateRemotePlayer } = useMultiplayerStore.getState()
            if (localPlayerId) {
              // Under geckos the movement/emote/clear blocks are the SOLE animation writers (so 'Run'/'Sprint'
              // survive); the echo must not clobber them with currentEmote (null while moving). Playroom keeps
              // its original behaviour where the echo carries currentEmote.
              updateRemotePlayer(localPlayerId, geckos
                ? { position: compressedPos, rotationY: compressedRotY }
                : { position: compressedPos, rotationY: compressedRotY, animation: currentEmote.current })
            }
          }
        }
      } catch (e) {
        // PlayroomKit not ready yet
      }
    }
  })

  return null
}
