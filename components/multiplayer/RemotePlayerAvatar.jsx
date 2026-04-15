import React, { useRef, memo, Suspense } from 'react'
import { Billboard, Text, Html, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CharacterSoldier } from './CharacterSoldier'
import ElonAvatar from './ElonAvatar'
import ElonMuskChibiAvatar from './ElonMuskChibiAvatar'
import Ai16zAvatar from './Ai16zAvatar'
import TrumpSkinAvatar from './TrumpSkinAvatar'
import AlonAvatar from './AlonAvatar'
import * as THREE from 'three'
import { EYE_HEIGHT } from '../../lib/camera/cameraConstants'
import { useViewStore } from '../../lib/camera/viewStore'
import { useKeyboardStore } from '../../lib/useKeyboardStore'
import { parseEmoteCodes, getEmoteById } from '../../lib/emotes/emotesConfig'
import { localPlayerLive } from '../../lib/localPlayerRef'

// Copied from playroom_guide CharacterController.jsx → PlayerInfo component
// Enhanced with chat bubble (nubesita) for Roblox-style live chat

// Camera sits at y=1.6 (eye level). The character model root is at y=0 (feet).
// So we need to map camera Y → character feet Y by subtracting 1.6.
const CAM_TO_FEET = EYE_HEIGHT

function RemotePlayerAvatarInner({ player, isLocal = false }) {
  const viewMode = useViewStore((s) => s.viewMode)
  const { isKeyPressed } = useKeyboardStore()
  const groupRef = useRef()
  const characterRef = useRef()

  // Smoothed position — only XZ, Y is always at ground (0)
  const smoothPos = useRef(new THREE.Vector3(
    player.position.x,
    0,                 // ALWAYS ON GROUND — feet level
    player.position.z
  ))
  const targetXZ = useRef(new THREE.Vector2(player.position.x, player.position.z))
  const prevPosXZ = useRef(new THREE.Vector2(player.position.x, player.position.z))
  const isMoving = useRef(false)
  const smoothRotY = useRef(player.rotationY || 0)

  useFrame(() => {
    if (!groupRef.current) return

    // LOCAL PLAYER: read live unquantized position written by useCameraControls every frame.
    // This prevents the 10cm quantization + 3-frame delay wobble on diagonal movement.
    // REMOTE PLAYERS: read from multiplayer store with network interpolation.
    if (isLocal && localPlayerLive.ready) {
      targetXZ.current.set(localPlayerLive.x, localPlayerLive.z)
    } else {
      targetXZ.current.set(player.position.x, player.position.z)
    }

    // Smooth interpolation for ALL players (local + remote)
    // Local player: direct follow (lerp=1) for zero wobble
    // Remote players: lower lerp for network smoothing
    const posLerp = isLocal ? 1 : 0.15
    const yLerp = isLocal ? 1 : 0.2

    // Smooth lerp XZ
    smoothPos.current.x += (targetXZ.current.x - smoothPos.current.x) * posLerp
    smoothPos.current.z += (targetXZ.current.y - smoothPos.current.z) * posLerp
    const srcY = (isLocal && localPlayerLive.ready) ? localPlayerLive.y : (player.position.y || CAM_TO_FEET)
    const targetY = Math.max(0, srcY - CAM_TO_FEET)
    smoothPos.current.y += (targetY - smoothPos.current.y) * yLerp

    groupRef.current.position.copy(smoothPos.current)

    // Detect movement for animation
    // LOCAL PLAYER: use keyboard state (fixes stuttering in third-person)
    // REMOTE PLAYERS: use position delta
    if (isLocal) {
      isMoving.current = isKeyPressed('w') || isKeyPressed('s')
    } else {
      const dx = smoothPos.current.x - prevPosXZ.current.x
      const dz = smoothPos.current.z - prevPosXZ.current.y
      isMoving.current = Math.sqrt(dx * dx + dz * dz) > 0.005
      prevPosXZ.current.set(smoothPos.current.x, smoothPos.current.z)
    }

    // Smooth rotate (Shortest path to avoid 360 jumps)
    if (characterRef.current) {
      // LOCAL PLAYER: use live rotation from useCameraControls (no quantization, no delay)
      // REMOTE PLAYERS: use rotation from multiplayer store
      const targetRot = (isLocal && localPlayerLive.ready) ? localPlayerLive.rotY : (player.rotationY || 0)
      let diff = targetRot - smoothRotY.current
      
      // Normalize to [-PI, PI] to always find the shortest rotation path
      while (diff < -Math.PI) diff += Math.PI * 2
      while (diff > Math.PI) diff -= Math.PI * 2
      
      smoothRotY.current += diff * (isLocal ? 1 : 0.1)
      characterRef.current.rotation.y = smoothRotY.current
    }
  })

  // Determine animation: Prioritize custom emote state from Playroom, fallback to movement
  const animation = player.animation || (isMoving.current ? 'Run' : 'Idle')

  // Scale for Alon skin: 25% bigger for normal, 40% bigger for admin
  const isAlonSkin = player.skinId === 'alon'
  const isAdmin = player.isAdmin || false
  const alonScale = isAlonSkin ? (isAdmin ? 1.4 : 1.25) : 1

  // Nickname/chat vertical offsets — adjusted for Alon scale (5.6x base * 1.25 alonScale = 7x total)
  const baseNameY = player.skinId === 'elonmuskchibi' ? 2.9 : player.skinId === 'trumpskin' ? 2.9 : 2.5
  const baseChatY = player.skinId === 'elonmuskchibi' ? 3.6 : player.skinId === 'trumpskin' ? 3.6 : 3.2
  const baseYtY = player.skinId === 'elonmuskchibi' ? 4.4 : player.skinId === 'trumpskin' ? 4.4 : 3.9
  const nameBillboardY = isAlonSkin ? 8.5 * alonScale : baseNameY
  const chatBillboardY = isAlonSkin ? 10.5 * alonScale : baseChatY
  const ytBillboardY = isAlonSkin ? 12.5 * alonScale : baseYtY

  return (
    <group ref={groupRef} position={[player.position.x, 0, player.position.z]}>
      {/* Character model — at feet level, per-player Suspense to avoid full-scene blink */}
      <group ref={characterRef} scale={[alonScale, alonScale, alonScale]}>
        <Suspense fallback={null}>
        {/* TEMPORARILY DISABLED: elon, ai16z, soldier — uncomment to re-enable */}
        {/* player.skinId === 'elon' ? (
          <ElonAvatar animation={animation} />
        ) : player.skinId === 'ai16z' ? (
          <Ai16zAvatar animation={animation} />
        ) : */}
        {player.skinId === 'elonmuskchibi' ? (
          <ElonMuskChibiAvatar animation={animation} />
        ) : player.skinId === 'trumpskin' ? (
          <TrumpSkinAvatar animation={animation} />
        ) : (
          <AlonAvatar animation={animation} />
        )}
        </Suspense>
      </group>

      {/* Admin glow effect — OUTSIDE characterRef to prevent trembling */}
      {isAdmin && (
        <mesh position={[0, 1.4, 0]} scale={[alonScale, alonScale, alonScale]}>
          <sphereGeometry args={[1.5, 32, 32]} />
          <meshBasicMaterial 
            color="#ff00ff" 
            transparent 
            opacity={0.1}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* ADMIN BADGE — shown above nickname */}
      {isAdmin && (
        <Billboard position-y={nameBillboardY + 0.6}>
          <Html
            center
            distanceFactor={3}
            zIndexRange={[0, 0]}
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <div className="admin-badge-gradient" style={{
              padding: '3px 10px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: '900',
              color: '#1a1a1a',
              textShadow: '0 1px 2px rgba(255,255,255,0.3)',
              boxShadow: '0 4px 15px rgba(255, 215, 0, 0.6), 0 0 30px rgba(255, 215, 0, 0.3)',
              whiteSpace: 'nowrap',
              border: '2px solid rgba(255, 255, 255, 0.5)',
            }}>
              👑 ADMIN
            </div>
          </Html>
        </Billboard>
      )}

      {/* Nickname billboard — ALWAYS show */}
      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
        position={[0, nameBillboardY, 0]}
      >
        {/* Music indicator - shown when player has music active */}
        {player.isMusicPlaying && (
          <Html 
            position={[1.2, 0, 0]} 
            center 
            distanceFactor={8}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[100, 0]}
          >
            <div className="music-indicator">♪</div>
          </Html>
        )}
        {/* Mic indicator - shown when player is push-to-talking */}
        {player.isMicActive && (
          <Html 
            position={[player.isMusicPlaying ? -1.2 : 1.2, 0, 0]} 
            center 
            distanceFactor={8}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[100, 0]}
          >
            <div className="mic-indicator">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" x2="12" y1="19" y2="22"/>
              </svg>
            </div>
          </Html>
        )}
        {isAdmin ? (
          <Html
            center
            distanceFactor={3}
            zIndexRange={[0, 0]}
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <div className="admin-nickname" style={{
              fontSize: '20px',
              fontWeight: '900',
              textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(255,0,255,0.5)',
              padding: '4px 10px',
              letterSpacing: '1px',
            }}>
              {player.name || 'Player'}
            </div>
          </Html>
        ) : (
          <Text
            fontSize={isAdmin ? 0.24 : 0.2}
            color={isAdmin ? '#ffff00' : '#ffffff'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {player.name}
          </Text>
        )}
      </Billboard>

      {/* CHAT BUBBLE — Nubesita blanca tipo Roblox */}
      {player.chatMessage && (
        <Billboard position-y={chatBillboardY}>
          <Html
            center
            distanceFactor={3}
            zIndexRange={[0, 0]}
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <div className={`chat-bubble-3d ${isLocal ? 'chat-bubble-3d--local' : ''}`}>
              {parseEmoteCodes(player.chatMessage).map((part, index) => {
                if (part.type === 'emote') {
                  const emote = getEmoteById(part.content)
                  if (emote) {
                    return (
                      <img
                        key={index}
                        src={emote.url}
                        alt={emote.name}
                        className="chat-emote-inline"
                        title={emote.name}
                        style={{ maxWidth: '32px', maxHeight: '32px' }}
                      />
                    )
                  }
                }
                if (part.type === 'klipy' && part.url) {
                  return (
                    <img
                      key={index}
                      src={part.url}
                      alt={part.content}
                      className="chat-emote-inline"
                      title="GIF"
                      style={{ maxWidth: '32px', maxHeight: '32px' }}
                    />
                  )
                }
                return <span key={index}>{part.content}</span>
              })}
              <div className="chat-bubble-arrow" />
            </div>
          </Html>
        </Billboard>
      )}

      {/* YOUTUBE THUMBNAIL — floating above player when playing YouTube music */}
      {player.isYouTubePlaying && player.youtubeVideoId && (
        <Billboard position-y={ytBillboardY}>
          <Html
            center
            distanceFactor={10}
            zIndexRange={[0, 0]}
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <div style={{
              position: 'relative',
              width: '240px',
              height: '135px',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 2px 16px rgba(255,0,0,0.5), 0 0 24px rgba(255,0,0,0.2)',
              border: '2px solid #ff0000',
            }}>
              <img
                src={`https://img.youtube.com/vi/${player.youtubeVideoId}/hqdefault.jpg`}
                alt="YouTube"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </Html>
        </Billboard>
      )}
    </group>
  )
}

// Memoize: only re-render when THIS player's data actually changed
// Prevents skin-change blink and unnecessary re-renders from other players' state updates
const RemotePlayerAvatar = memo(RemotePlayerAvatarInner, (prev, next) => {
  if (prev.isLocal !== next.isLocal) return false
  const p = prev.player
  const n = next.player
  if (!p || !n) return p === n
  return (
    p.id === n.id &&
    p.skinId === n.skinId &&
    p.name === n.name &&
    p.color === n.color &&
    p.isAdmin === n.isAdmin &&
    p.isMusicPlaying === n.isMusicPlaying &&
    p.isYouTubePlaying === n.isYouTubePlaying &&
    p.youtubeVideoId === n.youtubeVideoId &&
    p.isMicActive === n.isMicActive &&
    p.animation === n.animation &&
    p.chatMessage === n.chatMessage &&
    p.position.x === n.position.x &&
    p.position.y === n.position.y &&
    p.position.z === n.position.z &&
    p.rotationY === n.rotationY
  )
})

export default RemotePlayerAvatar

// Preload active skin GLBs at module level so Suspense never triggers on skin switch
// Note: elonMusk2Anim_KTX2.glb is excluded — it requires KTX2 loader setup via useGLTFKtx2
// TEMPORARILY DISABLED: soldier, ai16z preloads
// useGLTF.preload('/models/Character_Soldier.gltf')
// useGLTF.preload('/ai16z-v1.glb')
useGLTF.preload('/elonmuskchibi-v1.glb')
useGLTF.preload('/trumpskin-v1.glb')
useGLTF.preload('/alonskin-v1.glb')
