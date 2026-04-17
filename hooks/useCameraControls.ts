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
import { getHouseCollisionMesh } from '../lib/collisionRef'
import { setTeleportFunction } from '../lib/teleportController'
import { useZoneStore } from '../lib/zoneStore'

// Physics constants
const GRAVITY = -35
const JUMP_FORCE = 16

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
  const SPAWN_X = -59.95
  const SPAWN_Z = -87.86
  // SPAWN_ROT_DISPLAY is what shows in PositionDebug HUD
  // Internal quaternion angle = display angle + 180° (offset from atan2 convention)
  const SPAWN_ROT_DISPLAY = 74.61 // degrees shown in HUD
  const SPAWN_ROT = (SPAWN_ROT_DISPLAY + 180) * (Math.PI / 180)
  
  const playerPos = useRef(new Vector3(SPAWN_X, EYE_HEIGHT, SPAWN_Z))
  const velocity = useRef(new Vector3())
  const lastSafePos = useRef(new Vector3(SPAWN_X, EYE_HEIGHT, SPAWN_Z))

  // Mouse orbit state — yaw controls where the camera orbits, pitch controls height
  // orbitYaw = angle where camera sits relative to player (same convention as old SPAWN_ROT)
  const orbitYaw = useRef(SPAWN_ROT)
  const orbitPitch = useRef(CAM_INITIAL_PITCH)
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
  const POSITION_THRESHOLD = 0.08 // Only sync if moved >8cm
  const ROTATION_THRESHOLD = 0.04 // Only sync if rotated >2.3 degrees
  
  // Custom animation state override
  const currentEmote = useRef<string | null>(null)
  
  // Collision detection — separate raycasters for movement and camera
  const moveRaycaster = useRef(new Raycaster())
  const camRaycaster = useRef(new Raycaster())

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
  // MOUSE ORBIT — pointer lock on click, mousemove updates orbit angles
  // =============================================
  useEffect(() => {
    const canvas = gl.domElement
    
    const onMouseMove = (e: MouseEvent) => {
      // Only orbit when pointer is locked to the canvas
      if (document.pointerLockElement !== canvas) return
      if (cinematicMode) return
      
      orbitYaw.current -= e.movementX * MOUSE_SENSITIVITY
      orbitPitch.current = Math.max(
        CAM_MIN_PITCH,
        Math.min(CAM_MAX_PITCH, orbitPitch.current - e.movementY * MOUSE_SENSITIVITY)
      )
    }
    
    const onClick = () => {
      if (chatActive || lobbyVisible || cinematicMode) return
      canvas.requestPointerLock()
    }
    
    canvas.addEventListener('click', onClick)
    document.addEventListener('mousemove', onMouseMove)
    
    return () => {
      canvas.removeEventListener('click', onClick)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [gl, cinematicMode, chatActive, lobbyVisible])

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
    if (typing || chatActive || lobbyVisible) return

    const key = event.key.toLowerCase()
    // F9: Toggle cinematic free camera (handled by CinematicCamera.tsx)
    if (event.key === 'F9') {
      event.preventDefault()
      toggleCinematicMode()
      return
    }
    if (['w', 'a', 's', 'd', 'e', 'q', '1', '2', '3', '4', '5', '6'].includes(key)) {
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

  }, [addPressedKey, chatActive, lobbyVisible, setCurrentAnimation, activeSkinId])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const el = document.activeElement as any
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    if (typing || chatActive) return

    const key = event.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'e', 'q', '1', '2', '3', '4', '5', '6'].includes(key)) {
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
    // Cinematic free camera — handled by CinematicCamera.tsx, skip normal controls
    if (cinematicMode) return

    // Block movement while chat is active
    if (chatActive) return

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
    
    const speed = moveSpeed.current * delta * 1.6
    if (isKeyPressed('w')) velocity.current.add(forward.clone().multiplyScalar(speed))
    if (isKeyPressed('s')) velocity.current.add(forward.clone().multiplyScalar(-speed))
    if (isKeyPressed('a')) velocity.current.add(right.clone().multiplyScalar(-speed))
    if (isKeyPressed('d')) velocity.current.add(right.clone().multiplyScalar(speed))
    
    // Update player facing direction when moving (character turns toward movement)
    if (velocity.current.lengthSq() > 0.001) {
      playerFacingY.current = Math.atan2(velocity.current.x, velocity.current.z)
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

    // Ground check — zone-aware floor height
    const currentZone = useZoneStore.getState().currentZone
    // Interior floor: Blender Y ~311 + HouseScene OY offset (1.1857)
    const floorY = currentZone === 'interior' ? 311 + 1.1857 + EYE_HEIGHT : EYE_HEIGHT
    if (playerPos.current.y <= floorY) {
      playerPos.current.y = floorY
      velocityY.current = 0
      isOnGround.current = true
    }

    // Apply lateral movement with collision detection
    const collisionMesh = getHouseCollisionMesh()
    if (velocity.current.lengthSq() > 0.001 && collisionMesh) {
      // Check collision in movement direction
      const moveDir = velocity.current.clone().normalize()
      moveRaycaster.current.set(playerPos.current, moveDir)
      moveRaycaster.current.far = velocity.current.length() + 0.5 // Check a bit ahead
      
      const intersects = moveRaycaster.current.intersectObject(collisionMesh, false)
      
      if (intersects.length > 0 && intersects[0].distance < velocity.current.length() + 0.3) {
        // Collision detected - slide along wall instead of stopping
        const normal = intersects[0].face?.normal
        if (normal) {
          // Transform normal to world space
          const worldNormal = normal.clone().transformDirection(collisionMesh.matrixWorld)
          // Project velocity onto wall plane (slide)
          const slideVel = velocity.current.clone().sub(
            worldNormal.clone().multiplyScalar(velocity.current.dot(worldNormal))
          )
          velocity.current.copy(slideVel.multiplyScalar(0.9))
        }
      }
    }
    
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

    // World boundaries (invisible wall) — zone-aware
    if (currentZone === 'exterior') {
      // Exterior: based on collision house externo.glb
      const xMin = -79, xMax = 169, zMin = -112, zMax = 117
      playerPos.current.x = Math.max(xMin, Math.min(xMax, playerPos.current.x))
      playerPos.current.z = Math.max(zMin, Math.min(zMax, playerPos.current.z))
    } else if (currentZone === 'interior') {
      // Interior: room1 Blender bounds + HouseScene offset (OX=190.12, OZ=-88.67)
      const xMin = -197 + 190.12, xMax = -87 + 190.12, zMin = 13 + (-88.67), zMax = 163 + (-88.67)
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
    
    // Desired camera position (spherical coords around look-at point)
    const camOffset = new Vector3(
      Math.sin(yaw) * Math.cos(pitch) * CAM_DIST,
      Math.sin(pitch) * CAM_DIST,
      Math.cos(yaw) * Math.cos(pitch) * CAM_DIST,
    )
    const desiredCamPos = lookAtPoint.clone().add(camOffset)
    
    // =============================================
    // CAMERA COLLISION — raycast from player to desired camera position
    // If ray hits the collision mesh, pull camera closer to avoid clipping
    // =============================================
    let finalCamPos = desiredCamPos
    
    if (collisionMesh) {
      const rayOrigin = lookAtPoint.clone()
      const toDesired = desiredCamPos.clone().sub(rayOrigin)
      const rayLength = toDesired.length()
      
      if (rayLength > 0.01) {
        const rayDir = toDesired.clone().normalize()
        
        camRaycaster.current.set(rayOrigin, rayDir)
        camRaycaster.current.far = rayLength
        camRaycaster.current.near = 0
        
        const hits = camRaycaster.current.intersectObject(collisionMesh, false)
        
        if (hits.length > 0 && hits[0].distance < rayLength) {
          // Place camera just before the hit point
          const safeDist = Math.max(hits[0].distance - CAM_COLLISION_OFFSET, CAM_COLLISION_MIN)
          finalCamPos = rayOrigin.clone().add(rayDir.clone().multiplyScalar(safeDist))
        }
      }
    }

    // Smooth camera follow — frame-rate independent lerp
    camera.position.lerp(finalCamPos, 1 - Math.exp(-8 * delta))
    camera.lookAt(lookAtPoint)

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
