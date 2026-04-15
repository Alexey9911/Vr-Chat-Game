import React, { useEffect, useState } from 'react'
import { localPlayerLive } from '../lib/localPlayerRef'

export default function PositionDebug() {
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0, rotY: 0 })

  useEffect(() => {
    const interval = setInterval(() => {
      if (localPlayerLive.ready) {
        setPosition({
          x: localPlayerLive.x,
          y: localPlayerLive.y,
          z: localPlayerLive.z,
          rotY: localPlayerLive.rotY
        })
      }
    }, 100) // Actualiza cada 100ms

    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#00ff00',
      padding: '10px 15px',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '14px',
      zIndex: 9999,
      border: '2px solid #00ff00',
      boxShadow: '0 0 10px rgba(0, 255, 0, 0.3)'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#fff' }}>
        🎮 Player Position
      </div>
      <div>X: {position.x.toFixed(2)}</div>
      <div>Y: {position.y.toFixed(2)}</div>
      <div>Z: {position.z.toFixed(2)}</div>
      <div>Rot: {(((position.rotY * 180 / Math.PI) % 360 + 360) % 360).toFixed(2)}°</div>
    </div>
  )
}
