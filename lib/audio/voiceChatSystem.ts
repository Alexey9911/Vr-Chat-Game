/**
 * Voice Chat System — WebRTC Push-to-Talk
 * 
 * Peer-to-peer audio streaming using WebRTC.
 * Signaling is done via PlayroomKit RPC.
 * Spatial audio: volume based on distance (12m range).
 * 
 * Usage:
 *   1. initVoiceChat() — request mic, prepare local stream
 *   2. createOffer(remoteId) — initiate connection to a peer
 *   3. handleOffer/handleAnswer/handleIce — process signaling from peers
 *   4. startTransmitting() / stopTransmitting() — push-to-talk
 *   5. setVoiceVolume(peerId, volume) — spatial audio
 *   6. cleanup() — close all connections
 */

// Spatial audio config for voice
export const VOICE_MAX_DISTANCE = 80 // units — map is ~248x229, hear voice across ~1/3 of map
export const VOICE_MAX_VOLUME = 1.0  // 100% max volume at 0m

// Voice boost: 50% extra volume for remote players' mic so voice is clearly audible over music
const VOICE_BOOST = 1.5

// Mic volume multiplier (0-1), controlled by settings — how loud you hear OTHER players
let micVolumeMultiplier = 1.0 // Default 100%

// Local mic volume (0-2), controlled by settings — how loud OTHERS hear YOU
let localMicGainValue = 1.0 // Default 100%

export function setMicVolumeMultiplier(multiplier: number): void {
  micVolumeMultiplier = Math.max(0, Math.min(1, multiplier))
}

export function getMicVolumeMultiplier(): number {
  return micVolumeMultiplier
}

export function setLocalMicGain(gain: number): void {
  localMicGainValue = Math.max(0, Math.min(2, gain))
  // Apply gain to the GainNode if it exists
  if (micGainNode) {
    micGainNode.gain.value = localMicGainValue
  }
}

export function getLocalMicGain(): number {
  return localMicGainValue
}

// ICE servers for NAT traversal (STUN + TURN relay for cross-network support)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Free TURN relay servers — required for users behind symmetric NATs / different networks
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
]

interface PeerConnection {
  pc: RTCPeerConnection
  audioEl: HTMLAudioElement | null
  remoteStream: MediaStream | null
}

// State
let localStream: MediaStream | null = null
let localAudioTrack: MediaStreamTrack | null = null
let processedStream: MediaStream | null = null // Stream after GainNode processing (sent to peers)
let micGainNode: GainNode | null = null
let micAudioContext: AudioContext | null = null
let isTransmitting = false
let micPermissionGranted = false
const peers = new Map<string, PeerConnection>()

// Buffer ICE candidates that arrive before the offer/answer (race condition fix)
const pendingIceCandidates = new Map<string, string[]>()

// Safari/iOS autoplay fix: queue audio elements that failed to play
const pendingAudioPlayback: Set<HTMLAudioElement> = new Set()
let userGestureListenerAdded = false

function addUserGestureListener(): void {
  if (userGestureListenerAdded) return
  userGestureListenerAdded = true
  const resumeAll = () => {
    pendingAudioPlayback.forEach((audio) => {
      audio.play().catch(() => {})
    })
    pendingAudioPlayback.clear()
  }
  ;['click', 'touchstart', 'keydown'].forEach((evt) => {
    document.addEventListener(evt, resumeAll, { once: false, passive: true })
  })
}

function safariSafePlay(audioEl: HTMLAudioElement): void {
  // Set attributes needed for Safari/iOS
  audioEl.setAttribute('playsinline', 'true')
  audioEl.setAttribute('webkit-playsinline', 'true')
  const playPromise = audioEl.play()
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay blocked (Safari) — queue for user gesture resume
      pendingAudioPlayback.add(audioEl)
      addUserGestureListener()
      console.log('[VoiceChat] Audio autoplay blocked, queued for user gesture')
    })
  }
}

// RPC send function — set by LobbyScreen after PlayroomKit init
let rpcSendFn: ((event: string, data: any, to?: string) => void) | null = null
let localPlayerIdFn: (() => string | null) | null = null

/**
 * Set the RPC sender function (called from LobbyScreen)
 */
export function setRpcSender(fn: (event: string, data: any, to?: string) => void): void {
  rpcSendFn = fn
}

/**
 * Set the local player ID getter
 */
export function setLocalPlayerIdGetter(fn: () => string | null): void {
  localPlayerIdFn = fn
}

/**
 * Initialize voice chat — request microphone access
 * Returns true if mic permission was granted
 */
export async function initVoiceChat(): Promise<boolean> {
  if (localStream) return true // Already initialized

  // Use minimal constraints first — both reference repos (webrtc-group-chat, openai-voice-webrtc)
  // use { audio: true } without specifying echoCancellation/noiseSuppression/autoGainControl.
  // Explicitly setting these flags (even to true) causes Vivaldi/Opera to apply aggressive
  // audio processing that makes voice sound muffled/robotic.
  const constraintSets: MediaStreamConstraints[] = [
    { audio: true, video: false },
  ]

  for (const constraints of constraintSets) {
    try {
      console.log('[VoiceChat] Requesting mic with constraints:', JSON.stringify(constraints))
      localStream = await navigator.mediaDevices.getUserMedia(constraints)

      localAudioTrack = localStream.getAudioTracks()[0]
      if (localAudioTrack) {
        // Log track settings for debugging
        const settings = localAudioTrack.getSettings()
        console.log('[VoiceChat] Mic track settings:', JSON.stringify(settings))

        // Create AudioContext + GainNode for local mic volume control
        // This amplifies/attenuates the mic before sending to peers
        try {
          const AC = (window as any).AudioContext || (window as any).webkitAudioContext
          if (AC) {
            const ctx = new AC()
            micAudioContext = ctx
            const source = ctx.createMediaStreamSource(localStream)
            const gain = ctx.createGain()
            gain.gain.value = localMicGainValue
            source.connect(gain)
            const dest = ctx.createMediaStreamDestination()
            gain.connect(dest)
            micGainNode = gain
            processedStream = dest.stream
            console.log('[VoiceChat] Mic GainNode initialized (gain:', localMicGainValue, ')')
          }
        } catch (err) {
          console.warn('[VoiceChat] GainNode setup failed, using raw stream:', err)
          processedStream = localStream
        }

        // Start muted — only unmute during push-to-talk
        localAudioTrack.enabled = false
        micPermissionGranted = true
        console.log('[VoiceChat] Mic initialized (muted)')
        return true
      }
    } catch (err) {
      console.warn('[VoiceChat] Mic failed with constraints:', JSON.stringify(constraints), err)
      // Clean up partial stream before retrying
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop())
        localStream = null
        localAudioTrack = null
      }
    }
  }

  console.warn('[VoiceChat] All mic constraint attempts failed')
  micPermissionGranted = false
  return false
}

/**
 * Check if mic is available
 */
export function isMicAvailable(): boolean {
  return micPermissionGranted && localAudioTrack !== null
}

/**
 * Add local audio track to all existing peer connections.
 * Called when mic is initialized AFTER peer connections already exist (passive → active).
 */
export async function addLocalTrackToExistingPeers(): Promise<void> {
  const streamToSend = processedStream || localStream
  if (!streamToSend || !localAudioTrack) return
  const peersToRenegotiate: string[] = []
  peers.forEach((peer, remoteId) => {
    const senders = peer.pc.getSenders()
    const hasAudioSender = senders.some(s => s.track?.kind === 'audio')
    if (!hasAudioSender) {
      streamToSend.getTracks().forEach(track => {
        peer.pc.addTrack(track, streamToSend)
      })
      peersToRenegotiate.push(remoteId)
      console.log(`[VoiceChat] Added local track to existing peer ${remoteId}`)
    }
  })
  // Renegotiate connections that got new tracks
  for (const remoteId of peersToRenegotiate) {
    await createOffer(remoteId)
  }
}

/**
 * Check if currently transmitting (push-to-talk active)
 */
export function isCurrentlyTransmitting(): boolean {
  return isTransmitting
}

/**
 * Start transmitting (push-to-talk ON)
 */
export function startTransmitting(): void {
  if (!localAudioTrack || isTransmitting) return
  localAudioTrack.enabled = true
  isTransmitting = true
  console.log('[VoiceChat] Transmitting ON')
}

/**
 * Stop transmitting (push-to-talk OFF)
 */
export function stopTransmitting(): void {
  if (!localAudioTrack || !isTransmitting) return
  localAudioTrack.enabled = false
  isTransmitting = false
  console.log('[VoiceChat] Transmitting OFF')
}

/**
 * Get or create a peer connection for a remote player
 */
function getOrCreatePeer(remoteId: string): PeerConnection {
  let peer = peers.get(remoteId)
  if (peer) return peer

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

  // Add transceiver to receive audio — replaces deprecated offerToReceiveAudio
  // This ensures we can hear remote peers even if we don't have a local mic
  pc.addTransceiver('audio', { direction: 'sendrecv' })

  // Add local audio track to the connection (use processedStream with GainNode if available)
  const streamToSend = processedStream || localStream
  if (streamToSend && localAudioTrack) {
    const senders = pc.getSenders()
    const audioSender = senders.find(s => s.track?.kind === 'audio')
    const processedTrack = streamToSend.getAudioTracks()[0] || localAudioTrack
    if (audioSender) {
      audioSender.replaceTrack(processedTrack)
    } else {
      streamToSend.getTracks().forEach(track => {
        pc.addTrack(track, streamToSend)
      })
    }
  }

  const peerData: PeerConnection = {
    pc,
    audioEl: null,
    remoteStream: null,
  }

  // Handle incoming remote audio
  pc.ontrack = (event) => {
    console.log(`[VoiceChat] Received audio from ${remoteId}`)
    const remoteStream = event.streams[0] || new MediaStream([event.track])
    peerData.remoteStream = remoteStream

    // Create audio element for playback (Safari/iOS compatible)
    const audioEl = new Audio()
    audioEl.srcObject = remoteStream
    audioEl.autoplay = true
    audioEl.volume = VOICE_MAX_VOLUME
    audioEl.setAttribute('playsinline', 'true')
    audioEl.setAttribute('webkit-playsinline', 'true')
    peerData.audioEl = audioEl

    // Play with Safari autoplay fallback
    safariSafePlay(audioEl)
  }

  // Send ICE candidates to remote peer
  pc.onicecandidate = (event) => {
    if (event.candidate && rpcSendFn) {
      rpcSendFn('voiceIce', {
        from: localPlayerIdFn?.() || '',
        to: remoteId,
        candidate: JSON.stringify(event.candidate),
      })
    }
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      console.log(`[VoiceChat] Connection to ${remoteId} ${pc.connectionState}`)
      removePeer(remoteId)
    }
  }

  peers.set(remoteId, peerData)
  return peerData
}

/**
 * Create and send an SDP offer to a remote player
 */
export async function createOffer(remoteId: string): Promise<void> {
  if (!rpcSendFn) return

  // Never create peer to self
  const localId = localPlayerIdFn?.() || ''
  if (remoteId === localId) return

  const peer = getOrCreatePeer(remoteId)

  try {
    const offer = await peer.pc.createOffer()
    await peer.pc.setLocalDescription(offer)

    rpcSendFn('voiceOffer', {
      from: localId,
      to: remoteId,
      sdp: JSON.stringify(offer),
    })
    console.log(`[VoiceChat] Sent offer to ${remoteId}`)
  } catch (err) {
    console.warn('[VoiceChat] createOffer error:', err)
  }
}

/**
 * Handle incoming SDP offer from a remote player
 */
export async function handleOffer(fromId: string, sdpStr: string): Promise<void> {
  if (!rpcSendFn) return

  // Ignore self-offers
  const localId = localPlayerIdFn?.() || ''
  if (fromId === localId) return

  const peer = getOrCreatePeer(fromId)

  // Perfect negotiation: handle glare (both peers sent offers simultaneously)
  // "Polite" peer (smaller ID) rolls back; "impolite" peer ignores incoming offer
  const isPolite = localId < fromId
  const offerCollision = peer.pc.signalingState !== 'stable'

  if (offerCollision && !isPolite) {
    console.log(`[VoiceChat] Ignoring colliding offer from ${fromId} (impolite peer wins)`)
    return
  }

  try {
    // If polite and we have a pending offer, rollback first
    if (offerCollision) {
      console.log(`[VoiceChat] Rolling back local offer for ${fromId} (polite peer yields)`)
      await peer.pc.setLocalDescription({ type: 'rollback' })
    }

    const offer = JSON.parse(sdpStr) as RTCSessionDescriptionInit
    await peer.pc.setRemoteDescription(new RTCSessionDescription(offer))

    // Flush any ICE candidates that arrived before this offer
    await flushPendingCandidates(fromId, peer)

    const answer = await peer.pc.createAnswer()
    await peer.pc.setLocalDescription(answer)

    rpcSendFn('voiceAnswer', {
      from: localId,
      to: fromId,
      sdp: JSON.stringify(answer),
    })
    console.log(`[VoiceChat] Sent answer to ${fromId}`)
  } catch (err) {
    console.warn('[VoiceChat] handleOffer error:', err)
  }
}

/**
 * Handle incoming SDP answer from a remote player
 */
export async function handleAnswer(fromId: string, sdpStr: string): Promise<void> {
  // Ignore self
  const localId = localPlayerIdFn?.() || ''
  if (fromId === localId) return

  const peer = peers.get(fromId)
  if (!peer) return

  // Only accept answer if we're expecting one (have-local-offer state)
  if (peer.pc.signalingState !== 'have-local-offer') {
    console.log(`[VoiceChat] Ignoring answer from ${fromId} (state: ${peer.pc.signalingState})`)
    return
  }

  try {
    const answer = JSON.parse(sdpStr) as RTCSessionDescriptionInit
    await peer.pc.setRemoteDescription(new RTCSessionDescription(answer))
    console.log(`[VoiceChat] Received answer from ${fromId}`)

    // Flush any ICE candidates that arrived before this answer
    await flushPendingCandidates(fromId, peer)
  } catch (err) {
    console.warn('[VoiceChat] handleAnswer error:', err)
  }
}

/**
 * Handle incoming ICE candidate from a remote player
 */
export async function handleIceCandidate(fromId: string, candidateStr: string): Promise<void> {
  // Ignore self
  const localId = localPlayerIdFn?.() || ''
  if (fromId === localId) return

  const peer = peers.get(fromId)

  // If peer doesn't exist yet or remote description isn't set, buffer the candidate
  if (!peer || !peer.pc.remoteDescription) {
    let buffer = pendingIceCandidates.get(fromId)
    if (!buffer) {
      buffer = []
      pendingIceCandidates.set(fromId, buffer)
    }
    buffer.push(candidateStr)
    console.log(`[VoiceChat] Buffered ICE candidate from ${fromId} (${buffer.length} pending)`)
    return
  }

  try {
    const candidate = JSON.parse(candidateStr) as RTCIceCandidateInit
    await peer.pc.addIceCandidate(new RTCIceCandidate(candidate))
  } catch (err) {
    console.warn('[VoiceChat] handleIce error:', err)
  }
}

/**
 * Flush buffered ICE candidates after setRemoteDescription
 */
async function flushPendingCandidates(peerId: string, peer: PeerConnection): Promise<void> {
  const buffered = pendingIceCandidates.get(peerId)
  if (!buffered || buffered.length === 0) return

  console.log(`[VoiceChat] Flushing ${buffered.length} buffered ICE candidates for ${peerId}`)
  pendingIceCandidates.delete(peerId)

  for (const candidateStr of buffered) {
    try {
      const candidate = JSON.parse(candidateStr) as RTCIceCandidateInit
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (err) {
      console.warn('[VoiceChat] flush ICE error:', err)
    }
  }
}

/**
 * Set volume for a specific peer (spatial audio)
 */
export function setVoiceVolume(peerId: string, volume: number): void {
  const peer = peers.get(peerId)
  if (peer?.audioEl) {
    peer.audioEl.volume = Math.max(0, Math.min(1, volume))
  }
}

/**
 * Calculate voice volume based on distance (0-12m range)
 * Applies mic volume multiplier from settings
 */
export function calculateVoiceVolume(distance: number): number {
  if (distance >= VOICE_MAX_DISTANCE) return 0
  if (distance <= 0) return Math.min(1, VOICE_MAX_VOLUME * VOICE_BOOST * micVolumeMultiplier)
  const ratio = 1 - (distance / VOICE_MAX_DISTANCE)
  return Math.min(1, ratio * VOICE_MAX_VOLUME * VOICE_BOOST * micVolumeMultiplier)
}

/**
 * Remove a peer connection (player left)
 */
export function removePeer(peerId: string): void {
  const peer = peers.get(peerId)
  if (peer) {
    peer.pc.close()
    if (peer.audioEl) {
      peer.audioEl.pause()
      peer.audioEl.srcObject = null
      pendingAudioPlayback.delete(peer.audioEl)
    }
    peers.delete(peerId)
    pendingIceCandidates.delete(peerId)
    console.log(`[VoiceChat] Removed peer ${peerId}`)
  }
}

/**
 * Check if a peer connection exists
 */
export function hasPeer(peerId: string): boolean {
  return peers.has(peerId)
}

/**
 * Get all active peer IDs
 */
export function getActivePeerIds(): string[] {
  return Array.from(peers.keys())
}

/**
 * Get active voice audio instances for spatial audio update
 */
export function getActiveVoiceAudioMap(
  remotePlayers: Array<{ id: string; position: { x: number; z: number } }>
): Map<string, { audioEl: HTMLAudioElement; position: { x: number; z: number } }> {
  const result = new Map<string, { audioEl: HTMLAudioElement; position: { x: number; z: number } }>()

  // Build lookup map once instead of .find() per peer
  const playerMap = new Map<string, { x: number; z: number }>()
  for (const p of remotePlayers) {
    playerMap.set(p.id, p.position)
  }

  peers.forEach((peer, peerId) => {
    if (peer.audioEl && peer.remoteStream) {
      const pos = playerMap.get(peerId)
      if (pos) {
        result.set(peerId, {
          audioEl: peer.audioEl,
          position: { x: pos.x, z: pos.z },
        })
      }
    }
  })

  return result
}

/**
 * Cleanup all voice chat connections
 */
export function cleanupVoiceChat(): void {
  // Close all peer connections
  peers.forEach((peer, id) => {
    peer.pc.close()
    if (peer.audioEl) {
      peer.audioEl.pause()
      peer.audioEl.srcObject = null
    }
  })
  peers.clear()
  pendingIceCandidates.clear()
  pendingAudioPlayback.clear()

  // Stop local mic and GainNode
  if (micGainNode) {
    micGainNode.disconnect()
    micGainNode = null
  }
  if (micAudioContext) {
    micAudioContext.close()
    micAudioContext = null
  }
  if (localAudioTrack) {
    localAudioTrack.stop()
    localAudioTrack = null
  }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop())
    localStream = null
  }
  processedStream = null

  isTransmitting = false
  micPermissionGranted = false
  rpcSendFn = null
  localPlayerIdFn = null
  console.log('[VoiceChat] Cleaned up')
}
