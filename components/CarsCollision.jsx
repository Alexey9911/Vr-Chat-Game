import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  registerCollisionMesh,
  unregisterCollisionMesh,
} from '../lib/collisionRef'

// Invisible AABB collision boxes for the 4 parked cars outside the house.
// Values hardcoded from `public/alon_house/physics_cars.glb`
// (inspected via `scripts/inspect-glb.mjs`). Doing it manually instead of
// loading the GLB to save an extra fetch + GPU upload — the file is
// essentially just 4 box volumes, no geometry worth rendering.
//
// DRAW CALLS: Each mesh has `visible = false`, so Three.js skips rendering
// entirely → 0 draw calls for all 4 boxes. The only cost is the raycast
// performed in `hooks/useCameraControls.ts` (4 extra AABB intersections
// per camera/player step — negligible).
//
// Coords are Blender-space centers; the parent <group> applies the same
// offset used by HouseScene / HouseExteriorCollision.
const OX = 190.12, OY = 1.1857, OZ = -88.67

const CARS = [
  { id: 'car1_collision', center: [-276.67, 6.19,  49.28], size: [38.69, 15.75, 16.81] },
  { id: 'car2_collision', center: [-273.45, 6.10,  75.14], size: [39.69, 20.96, 19.18] },
  { id: 'car3_collision', center: [-273.33, 6.11, 104.65], size: [41.09, 20.96, 19.33] },
  { id: 'car4_collision', center: [-273.47, 5.36, 138.24], size: [37.82, 13.52, 18.13] },
]

export default function CarsCollision() {
  const groupRef = useRef(null)
  const meshRefs = useRef([])

  // Shared geometry + material: 1 unit box scaled per-car. Shared so we
  // don't allocate 4 identical BufferGeometries — cheap either way, but
  // consistent with the other collision components.
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, visible: false }),
    []
  )

  useEffect(() => {
    const registered = []
    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      mesh.visible = false
      mesh.updateMatrixWorld(true)
      registerCollisionMesh(CARS[i].id, mesh)
      registered.push(CARS[i].id)

      // Debug: verify world-space AABB
      const box = new THREE.Box3().setFromObject(mesh)
      const size = new THREE.Vector3()
      const center = new THREE.Vector3()
      box.getSize(size)
      box.getCenter(center)
      // eslint-disable-next-line no-console
      console.log(
        `[collision] ${CARS[i].id} world center:(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}) size:(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`
      )
    })
    return () => {
      registered.forEach((id) => unregisterCollisionMesh(id))
    }
  }, [])

  return (
    <group position={[OX, OY, OZ]} ref={groupRef}>
      {CARS.map((car, i) => (
        <mesh
          key={car.id}
          ref={(el) => { meshRefs.current[i] = el }}
          position={car.center}
          scale={car.size}
          geometry={geometry}
          material={material}
          visible={false}
        />
      ))}
    </group>
  )
}
