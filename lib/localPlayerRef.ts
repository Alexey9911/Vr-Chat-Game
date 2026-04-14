/**
 * Shared live position/rotation for the local player.
 * Written every frame by useCameraControls — full precision, no throttling, no quantization.
 * Read every frame by RemotePlayerAvatar (isLocal=true) to keep the character model
 * perfectly in sync with the camera without any wobble on diagonal movement.
 */
export const localPlayerLive = {
  x: 0,
  y: 0,
  z: 0,
  rotY: 0,
  ready: false,
}

export function setLocalPlayerLive(x: number, y: number, z: number, rotY: number) {
  localPlayerLive.x = x
  localPlayerLive.y = y
  localPlayerLive.z = z
  localPlayerLive.rotY = rotY
  localPlayerLive.ready = true
}
