import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useControls, folder } from 'leva'
import * as THREE from 'three'

/**
 * Debug-only component: live-controls camera.near / camera.far via leva panel.
 * Mount inside <Canvas>. The leva panel appears top-right in the browser.
 * Press `H` on the panel to hide it.
 *
 * Goal: find the right `far` value so distant rooms / house get culled
 * without visible pop-in.
 */
export default function DebugCameraFar() {
  const { camera } = useThree()

  const { far, near, showHelper } = useControls('Camera Frustum', {
    near: { value: 0.1, min: 0.01, max: 10, step: 0.01 },
    far: { value: 1000, min: 50, max: 5000, step: 10 },
    showHelper: { value: false, label: 'Show frustum helper' },
  })

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    camera.near = near
    camera.far = far
    camera.updateProjectionMatrix()
  }, [camera, near, far])

  // Visualize the frustum as a wireframe (useful to see what gets culled)
  useEffect(() => {
    if (!showHelper) return
    const helper = new THREE.CameraHelper(camera)
    camera.parent?.add(helper)
    return () => {
      camera.parent?.remove(helper)
      helper.dispose()
    }
  }, [camera, showHelper])

  return null
}
