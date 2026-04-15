import React, { useState, useEffect } from 'react'
import { useThree } from '@react-three/fiber'

export default function CameraDebugHUD() {
  const { camera } = useThree()
  const [far, setFar] = useState(1000)
  const [near, setNear] = useState(0.1)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault()
        setVisible(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if ((camera as any).isPerspectiveCamera) {
      ;(camera as any).far = far
      ;(camera as any).near = near
      ;(camera as any).updateProjectionMatrix()
    }
  }, [camera, far, near])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      top: '100px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.85)',
      color: '#00ff00',
      padding: '15px 20px',
      borderRadius: '8px',
      fontFamily: 'monospace',
      fontSize: '13px',
      zIndex: 9999,
      border: '2px solid #00ff00',
      boxShadow: '0 0 15px rgba(0, 255, 0, 0.4)',
      minWidth: '280px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#fff', fontSize: '15px' }}>
        📹 Camera Debug (F8)
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px', color: '#aaa' }}>
          Far Distance: {far.toFixed(0)} units
        </label>
        <input 
          type="range" 
          min="50" 
          max="2000" 
          step="10"
          value={far}
          onChange={(e) => setFar(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#00ff00' }}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px', color: '#aaa' }}>
          Near Distance: {near.toFixed(2)} units
        </label>
        <input 
          type="range" 
          min="0.01" 
          max="5" 
          step="0.01"
          value={near}
          onChange={(e) => setNear(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#00ff00' }}
        />
      </div>

      <div style={{ 
        marginTop: '12px', 
        paddingTop: '12px', 
        borderTop: '1px solid rgba(0, 255, 0, 0.3)',
        fontSize: '11px',
        color: '#888'
      }}>
        <div>Far = distancia esférica 3D desde cámara</div>
        <div>Objetos más lejos = no renderizados</div>
        <div style={{ marginTop: '6px', color: '#00ff00' }}>
          Recomendado: Exterior ~500, Interior ~100
        </div>
      </div>

      <div style={{
        marginTop: '10px',
        display: 'flex',
        gap: '8px'
      }}>
        <button
          onClick={() => setFar(500)}
          style={{
            flex: 1,
            padding: '6px',
            background: '#004400',
            color: '#00ff00',
            border: '1px solid #00ff00',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Exterior (500)
        </button>
        <button
          onClick={() => setFar(100)}
          style={{
            flex: 1,
            padding: '6px',
            background: '#004400',
            color: '#00ff00',
            border: '1px solid #00ff00',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Interior (100)
        </button>
      </div>
    </div>
  )
}
