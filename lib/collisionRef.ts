// Global reference to the house collision mesh for raycasting
// Set by HouseScene.jsx, read by useCameraControls.ts
// Using a separate module avoids circular/cross-format imports that break Turbopack

import * as THREE from 'three'

// Legacy single-mesh slot (kept for backward compatibility)
let _collisionMesh: THREE.Mesh | null = null

// Multi-mesh registry: keyed by a stable id so registrations can be replaced on re-mount
const _meshes = new Map<string, THREE.Mesh>()

export function setHouseCollisionMesh(mesh: THREE.Mesh | null) {
  _collisionMesh = mesh
}

export function getHouseCollisionMesh(): THREE.Mesh | null {
  return _collisionMesh
}

export function registerCollisionMesh(id: string, mesh: THREE.Mesh) {
  _meshes.set(id, mesh)
}

export function unregisterCollisionMesh(id: string) {
  _meshes.delete(id)
}

export function getCollisionMeshes(): THREE.Mesh[] {
  const list: THREE.Mesh[] = []
  if (_collisionMesh) list.push(_collisionMesh)
  _meshes.forEach((m) => list.push(m))
  return list
}
