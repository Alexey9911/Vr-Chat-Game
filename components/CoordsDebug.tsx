import React, { useEffect, useState } from 'react'
import { localPlayerLive } from '../lib/localPlayerRef'

/**
 * Small live-coordinates HUD for debugging spawn/checkpoint positions.
 * Reads directly from the `localPlayerLive` ref that useCameraControls writes
 * every frame. rAF loop at render throttle keeps it cheap.
 *
 * Sits below the CA section (top: 130px) and shares the same visual style
 * so it feels part of the in-game HUD. Position is clamped on ultra-wide
 * monitors via the `.coords-debug` entries in the QHD virtual-stage CSS.
 */
export default function CoordsDebug() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let rafId = 0
    let last = 0
    const loop = (now: number) => {
      // ~10 fps is plenty for a coords readout and saves React re-renders.
      if (now - last > 100) {
        last = now
        setTick((t) => t + 1)
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const { x, y, z, rotY, ready } = localPlayerLive
  const rotDeg = ((rotY * 180) / Math.PI + 360) % 360

  return (
    <div
      className="coords-debug"
      data-tick={tick}
      style={{
        position: 'fixed',
        top: '130px',
        left: '30px',
        zIndex: 1000,
        background: 'rgba(15, 15, 20, 0.55)',
        padding: '10px 14px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderLeft: '4px solid #f59e0b',
        clipPath: 'polygon(0 0, 100% 0, 96% 100%, 0 100%)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontSize: '12px',
        color: '#e5e7eb',
        lineHeight: 1.5,
        minWidth: '180px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          color: '#f59e0b',
          fontSize: '10px',
          fontWeight: 900,
          letterSpacing: '1.5px',
          marginBottom: '4px',
          fontFamily: "'Burbank Big Condensed', 'Arial Black', Impact, sans-serif",
        }}
      >
        COORDS
      </div>
      {ready ? (
        <>
          <div>X: <span style={{ color: '#60a5fa' }}>{x.toFixed(2)}</span></div>
          <div>Y: <span style={{ color: '#34d399' }}>{y.toFixed(2)}</span></div>
          <div>Z: <span style={{ color: '#f87171' }}>{z.toFixed(2)}</span></div>
          <div style={{ opacity: 0.7 }}>ROT: {rotDeg.toFixed(0)}°</div>
        </>
      ) : (
        <div style={{ opacity: 0.5 }}>waiting…</div>
      )}
    </div>
  )
}
