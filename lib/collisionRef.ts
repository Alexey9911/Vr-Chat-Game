// Global reference to the house collision mesh for raycasting
// Set by HouseScene.jsx, read by useCameraControls.ts
// Using a separate module avoids circular/cross-format imports that break Turbopack

import * as THREE from 'three'

let _collisionMesh: THREE.Mesh | null = null

export function setHouseCollisionMesh(mesh: THREE.Mesh | null) {
  _collisionMesh = mesh
}

export function getHouseCollisionMesh(): THREE.Mesh | null {
  return _collisionMesh
}
