import React, { useEffect, useState } from 'react'

interface FadeOverlayProps {
  isActive: boolean
  onFadeComplete?: () => void
}

export default function FadeOverlay({ isActive, onFadeComplete }: FadeOverlayProps) {
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    if (isActive) {
      // Fade to black
      setOpacity(1)
      const timer = setTimeout(() => {
        onFadeComplete?.()
        // Start fade out after teleport
        setTimeout(() => setOpacity(0), 100)
      }, 500) // Wait 500ms at full black before teleporting
      return () => clearTimeout(timer)
    }
  }, [isActive, onFadeComplete])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        opacity,
        transition: 'opacity 500ms ease-in-out',
        pointerEvents: 'none',
        zIndex: 10000,
      }}
    />
  )
}
