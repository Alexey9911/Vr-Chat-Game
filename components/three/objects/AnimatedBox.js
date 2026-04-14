import { editable as e } from '@theatre/r3f'

export default function AnimatedBox() {
  return (
    <e.mesh 
      theatreKey="Box" 
      position={[0, 0, 0]}
      scale={[1, 1, 1]}
      rotation={[0, 0, 0]}
    >
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#6366f1" />
    </e.mesh>
  )
}
