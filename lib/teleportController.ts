import * as THREE from 'three'

// Global reference to teleport function - set by useCameraControls
let teleportFn: ((pos: THREE.Vector3, rotY: number) => void) | null = null

export function setTeleportFunction(fn: (pos: THREE.Vector3, rotY: number) => void) {
  teleportFn = fn
}

export function teleportPlayer(position: THREE.Vector3, rotationY: number) {
  if (teleportFn) {
    teleportFn(position, rotationY)
  } else {
    console.warn('[Teleport] Teleport function not initialized yet')
  }
}
