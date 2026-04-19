import React from 'react'
import { useProgress } from '@react-three/drei'

type Props = {
  onReady: () => void
  threshold?: number
  minDurationMs?: number
}

export default function EntryLoadingOverlay({
  onReady,
  threshold = 90,
  minDurationMs = 1500,
}: Props) {
  const { progress } = useProgress()
  const [stableProgress, setStableProgress] = React.useState(0)
  const startedAt = React.useRef<number | null>(null)
  const fired = React.useRef(false)

  React.useEffect(() => {
    if (startedAt.current === null) startedAt.current = performance.now()
    setStableProgress((p) => Math.max(p, Math.round(progress)))
  }, [progress])

  // Simple rule: dismiss when progress ≥ threshold AND minimum splash
  // duration has elapsed. No idle-window / no active flag — both caused
  // subtle stuck-at-100% bugs (the progress manager never re-renders
  // this component after the last asset finishes, so effects with
  // time-based checks never re-fire). Polling at 5 Hz is cheap and
  // bulletproof: the interval fires regardless of React state changes.
  React.useEffect(() => {
    if (fired.current) return
    const id = window.setInterval(() => {
      if (fired.current) return
      const elapsed = performance.now() - (startedAt.current ?? performance.now())
      if (stableProgress >= threshold && elapsed >= minDurationMs) {
        fired.current = true
        window.clearInterval(id)
        onReady()
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [minDurationMs, onReady, stableProgress, threshold])

  return (
    <div className="loading" style={{ position: 'fixed', inset: 0, transform: 'none', top: 0, left: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 99999, background: 'linear-gradient(135deg, #00f2fe 0%, #10b981 100%)' }}>
      <img
        src="/elonkiss.png"
        alt="Loading AlonHouse..."
        style={{ width: 400, height: 400, objectFit: 'contain', marginBottom: 30, animation: 'simpleFade 1.5s infinite ease-in-out', filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.4))' }}
      />
      <div style={{ color: '#ffffff', fontWeight: 900, fontSize: 54, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', fontFamily: 'inherit', textShadow: '0 4px 10px rgba(0, 0, 0, 0.15)' }}>
        loading
        <div style={{ fontSize: 32, opacity: 0.9, marginTop: 15, letterSpacing: 2, fontWeight: 700 }}>
          {Math.min(100, stableProgress)}%
        </div>
      </div>
    </div>
  )
}

