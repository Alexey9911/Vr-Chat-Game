import React, { useEffect } from 'react'
import { useMultiplayerStore } from '../../lib/multiplayerStore'

export default function AdminFloatButton() {
  const { isAdmin, adminPanelVisible, toggleAdminPanel } = useMultiplayerStore()

  useEffect(() => {
    if (!isAdmin) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+A to toggle admin panel
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault()
        toggleAdminPanel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAdmin, toggleAdminPanel])

  if (!isAdmin) return null

  return (
    <button
      className="admin-float-btn"
      onClick={toggleAdminPanel}
      title="Admin Panel (Ctrl+A)"
    >
      🔧
    </button>
  )
}
