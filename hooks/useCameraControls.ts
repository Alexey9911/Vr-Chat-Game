import { useRef, useEffect, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, Quaternion } from 'three'
import { useKeyboardStore } from '../lib/useKeyboardStore'
import { useMultiplayerStore } from '../lib/multiplayerStore'
import { EYE_HEIGHT } from '../lib/camera/cameraConstants'
import { useViewStore } from '../lib/camera/viewStore'
import { useSkinStore } from '../lib/skins/skinStore'
import { compressPosition, compressRotation } from './usePositionSync'
import { setLocalPlayerLive } from '../lib/localPlayerRef'

// Physics constants
const GRAVITY = -20
const JUMP_FORCE = 8
const GROUND_Y = EYE_HEIGHT

export const useCameraControls = () => {
  const { camera } = useThree()
  const { addPressedKey, removePressedKey, setPressedKeys, isKeyPressed, chatActive, setCurrentAnimation } = useKeyboardStore()
  const viewMode = useViewStore((s) => s.viewMode)
  const toggleViewMode = useViewStore((s) => s.toggleViewMode)
  const activeSkinId = useSkinStore((s) => s.activeSkinId)
  const lobbyVisible = useMultiplayerStore((s) => s.lobbyVisible)
  
  // Movement parameters
  const moveSpeed = useRef(5)
  const rotateSpeed = useRef(2)
  
  // Camera state
  const playerPos = useRef(new Vector3(0, GROUND_Y, 5))
  const velocity = useRef(new Vector3())
  const direction = useRef(new Vector3())
  const rotation = useRef(new Quaternion())
  const lastSafePos = useRef(new Vector3(0, GROUND_Y, 5))
  const cameraTarget = useRef(new Vector3(0, GROUND_Y, 5))
  const lookTarget = useRef(new Vector3(0, GROUND_Y, 0))

  // Jump physics
  const velocityY = useRef(0)        // vertical velocity
  const isOnGround = useRef(true)   // is character touching ground?
  const spaceWasDown = useRef(false) // to detect rising edge of space key

  // Multiplayer sync counter
  const syncCounter = useRef(0)
  const playroomRef = useRef<any>(null)
  
  // Position throttling for network optimization
  const lastSentPos = useRef(new Vector3(0, GROUND_Y, 5))
  const lastSentRotY = useRef(0)
  const POSITION_THRESHOLD = 0.08 // Only sync if moved >8cm
  const ROTATION_THRESHOLD = 0.04 // Only sync if rotated >2.3 degrees
  
  // Custom animation state override
  const currentEmote = useRef<string | null>(null)

  // Cinematic orbit camera (F9 toggle) — slow 360° rotation for recording clips
  const cinematicMode = useRef(false)
  const cinematicAngle = useRef(0)
  const CINEMATIC_RADIUS = 18
  const CINEMATIC_HEIGHT = 6
  const CINEMATIC_SPEED = 0.15 // radians/sec (~42s per full rotation)
  const CINEMATIC_CENTER = new Vector3(0, 0, -6) // scene center
  
  // Initialize rotation with current camera rotation
  useEffect(() => {
    rotation.current.copy(camera.quaternion)
    playerPos.current.copy(camera.position)
    playerPos.current.y = Math.max(GROUND_Y, playerPos.current.y)
    lastSafePos.current.copy(playerPos.current)
  }, [camera])

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
    if (typing || chatActive || lobbyVisible) return

    const key = event.key.toLowerCase()
    if (key === 'j') {
      event.preventDefault()
      toggleViewMode()
      return
    }
    // F9: Toggle cinematic orbit camera for recording
    if (event.key === 'F9') {
      event.preventDefault()
      cinematicMode.current = !cinematicMode.current
      if (cinematicMode.current) {
        // Start from current camera angle relative to center
        const dx = camera.position.x - CINEMATIC_CENTER.x
        const dz = camera.position.z - CINEMATIC_CENTER.z
        cinematicAngle.current = Math.atan2(dx, dz)
        console.log('[Cinematic] Orbit camera ON — press F9 to stop')
      } else {
        console.log('[Cinematic] Orbit camera OFF')
      }
      return
    }
    if (['w', 'a', 's', 'd', '1', '2', '3', '4', '5', '6'].includes(key)) {
      // Solo preventDefault para wasd
      if (['w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault()
      }
      addPressedKey(key)
    }
    // Space: track for jump (prevent page scroll)
    if (event.code === 'Space') {
      event.preventDefault()
      addPressedKey(' ')
    }

    // EMOTES (Number keys) - Dynamic based on active skin
    // alon/elonmuskchibi/trumpskin: 4 emotes (keys 2-5)
    // TEMPORARILY DISABLED: elon (0 emotes), ai16z (3 emotes)
    let animMap: Record<string, string> = {
      '2': 'Punch',
      '3': 'Yes',
      '4': 'Wave',
      '5': 'Death',
    }
    
    if (activeSkinId === 'elon') {
      // Elon only has Idle + Run, no emotes available
      animMap = {}
    } else if (activeSkinId === 'ai16z') {
      // ai16z: 3 emotes (keys 2-4)
      animMap = {
        '2': 'Yes',
        '3': 'Wave',
        '4': 'Death',
      }
    }
    
    if (animMap[key] && playroomRef.current?.myPlayer?.()) {
      currentEmote.current = animMap[key]
      setCurrentAnimation(animMap[key])
      playroomRef.current.myPlayer().setState('animation', animMap[key], true)
      
      // Update local player in store so their own avatar animates
      const { localPlayerId, updateRemotePlayer } = useMultiplayerStore.getState()
      if (localPlayerId) {
        updateRemotePlayer(localPlayerId, { animation: animMap[key] })
      }
    }

  }, [addPressedKey, chatActive, lobbyVisible, setCurrentAnimation, activeSkinId, toggleViewMode])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const el = document.activeElement as any
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    if (typing || chatActive) return

    const key = event.key.toLowerCase()
    if (['w', 'a', 's', 'd', '1', '2', '3', '4', '5', '6'].includes(key)) {
      if (['w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault()
      }
      removePressedKey(key)
    }
    if (event.code === 'Space') {
      event.preventDefault()
      removePressedKey(' ')
    }
  }, [removePressedKey, chatActive])

  useEffect(() => {
    const clear = () => setPressedKeys(new Set())
    window.addEventListener('focusin', clear, true)
    window.addEventListener('focusout', clear, true)
    return () => {
      window.removeEventListener('focusin', clear, true)
      window.removeEventListener('focusout', clear, true)
    }
  }, [setPressedKeys])

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
    // Cinematic orbit camera — overrides normal camera
    if (cinematicMode.current) {
      cinematicAngle.current += CINEMATIC_SPEED * delta
      const a = cinematicAngle.current
      camera.position.set(
        CINEMATIC_CENTER.x + Math.sin(a) * CINEMATIC_RADIUS,
        CINEMATIC_HEIGHT,
        CINEMATIC_CENTER.z + Math.cos(a) * CINEMATIC_RADIUS
      )
      camera.lookAt(CINEMATIC_CENTER.x, 1.5, CINEMATIC_CENTER.z)
      return
    }

    // Block movement while chat is active
    if (chatActive) return

    // Reset lateral velocity
    velocity.current.set(0, 0, 0)
    
    // Handle rotation (A/D keys)
    if (isKeyPressed('a')) {
      rotation.current.multiply(
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotateSpeed.current * delta * 1.4)
      )
    }
    if (isKeyPressed('d')) {
      rotation.current.multiply(
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -rotateSpeed.current * delta * 1.4)
      )
    }
    
    // Calculate forward direction from player rotation
    direction.current.set(0, 0, -1)
    direction.current.applyQuaternion(rotation.current)
    direction.current.y = 0 // Keep movement horizontal
    direction.current.normalize()
    
    // Handle forward/backward movement (W/S keys)
    if (isKeyPressed('w')) {
      velocity.current.add(direction.current.clone().multiplyScalar(moveSpeed.current * delta * 1.6))
    }
    if (isKeyPressed('s')) {
      velocity.current.add(direction.current.clone().multiplyScalar(-moveSpeed.current * delta * 1.6))
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

    // Ground check
    if (playerPos.current.y <= GROUND_Y) {
      playerPos.current.y = GROUND_Y
      velocityY.current = 0
      isOnGround.current = true
    }

    // Apply lateral movement
    playerPos.current.add(velocity.current)

    // Clear emote if player starts moving
    if (velocity.current.lengthSq() > 0.001 && currentEmote.current !== null) {
      currentEmote.current = null
      setCurrentAnimation(null)
      if (playroomRef.current?.myPlayer?.()) {
        playroomRef.current.myPlayer().setState('animation', null, true)
        
        // Clear local player animation
        const { localPlayerId, updateRemotePlayer } = useMultiplayerStore.getState()
        if (localPlayerId) {
          updateRemotePlayer(localPlayerId, { animation: null })
        }
      }
    }

    // World boundaries (invisible wall)
    const xMax = 30
    const zMax = 20
    playerPos.current.x = Math.max(-xMax, Math.min(xMax, playerPos.current.x))
    playerPos.current.z = Math.max(-zMax, Math.min(zMax, playerPos.current.z))

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
      if (dx * dx + dy * dy + dz * dz > maxStep * maxStep) {
        pos.copy(lastSafePos.current)
      } else {
        lastSafePos.current.copy(pos)
      }
    }

    // Update live ref EVERY frame with full precision — RemotePlayerAvatar reads this
    // to keep the local player character model in sync without quantization wobble
    const liveRotY = Math.atan2(direction.current.x, direction.current.z)
    setLocalPlayerLive(playerPos.current.x, playerPos.current.y, playerPos.current.z, liveRotY)

    if (viewMode === 'firstPerson') {
      camera.position.copy(playerPos.current)
      camera.quaternion.copy(rotation.current)
    } else {
      const camDist = 4.2
      const camUp = 0.45
      cameraTarget.current.copy(playerPos.current)
      cameraTarget.current.add(direction.current.clone().multiplyScalar(-camDist))
      cameraTarget.current.y += camUp
      // Frame-rate independent lerp (equivalent to ~0.12 at 60fps)
      camera.position.lerp(cameraTarget.current, 1 - Math.exp(-8 * delta))

      lookTarget.current.set(playerPos.current.x, playerPos.current.y - 0.35, playerPos.current.z)
      camera.lookAt(lookTarget.current)
    }

    // =============================================
    // MULTIPLAYER: Sync camera position with throttling (OPTIMIZED)
    // Only sends updates when position/rotation changes significantly
    // Reduces network traffic by 70-80% when idle
    // =============================================
    syncCounter.current++
    if (syncCounter.current % 3 === 0 && playroomRef.current) {
      try {
        const pk = playroomRef.current
        const me = pk.myPlayer?.()
        if (me) {
          // Calculate rotation Y
          const forward = new Vector3(0, 0, -1).applyQuaternion(rotation.current)
          const rotY = Math.atan2(forward.x, forward.z)
          
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
            
            me.setState('pos', compressedPos, true)
            me.setState('rotY', compressedRotY, true)

            lastSentPos.current.copy(playerPos.current)
            lastSentRotY.current = rotY

            const { localPlayerId, updateRemotePlayer } = useMultiplayerStore.getState()
            if (localPlayerId) {
              updateRemotePlayer(localPlayerId, {
                position: compressedPos,
                rotationY: compressedRotY,
                animation: currentEmote.current,
              })
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
