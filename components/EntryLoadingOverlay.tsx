import React from 'react'
import { useProgress } from '@react-three/drei'

type Props = {
  onReady: () => void
  threshold?: number
  minDurationMs?: number
}

export default function EntryLoadingOverlay({
  onReady,
  threshold = 70,
  minDurationMs = 1500,
}: Props) {
  const { progress, active } = useProgress()
  const [stableProgress, setStableProgress] = React.useState(0)
  const startedAt = React.useRef<number | null>(null)
  const fired = React.useRef(false)

  React.useEffect(() => {
    if (startedAt.current === null) startedAt.current = performance.now()
    setStableProgress((p) => Math.max(p, Math.round(progress)))
  }, [progress])

  React.useEffect(() => {
    if (fired.current) return
    const t = startedAt.current ?? performance.now()
    const elapsed = performance.now() - t
    const ready = stableProgress >= threshold && elapsed >= minDurationMs
    if (ready || (!active && stableProgress >= threshold)) {
      fired.current = true
      onReady()
    }
  }, [active, minDurationMs, onReady, stableProgress, threshold])

  return (
    <div className="loading" style={{ position: 'fixed', inset: 0, transform: 'none', top: 0, left: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
      <img
        src="/elonkiss.png"
        alt="Loading"
        style={{ width: 224, height: 224, objectFit: 'contain', marginBottom: 24, animation: 'simpleFade 1.5s infinite ease-in-out' }}
      />
      <div style={{ color: '#fff', fontWeight: 500, fontSize: 32, letterSpacing: 2, textAlign: 'center', fontFamily: 'inherit' }}>
        loading
        <div style={{ fontSize: 18, opacity: 0.8, marginTop: 12, letterSpacing: 1, fontWeight: 400 }}>
          {Math.min(100, stableProgress)}%
        </div>
      </div>
    </div>
  )
}

