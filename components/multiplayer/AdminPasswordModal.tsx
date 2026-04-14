import React, { useState } from 'react'
import { validateAdminPassword, setAdminStatus } from '../../lib/auth/adminAuth'
import { useMultiplayerStore } from '../../lib/multiplayerStore'

interface AdminPasswordModalProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function AdminPasswordModal({ onSuccess, onCancel }: AdminPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)
  const { setIsAdmin } = useMultiplayerStore()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (validateAdminPassword(password)) {
      // Success - grant admin access
      setIsAdmin(true)
      setAdminStatus(true)
      onSuccess()
    } else {
      // Failed attempt
      setAttempts(prev => prev + 1)
      setError(`Incorrect password. Attempt ${attempts + 1}/3`)
      setPassword('')
      
      // After 3 failed attempts, block admin access
      if (attempts >= 2) {
        setTimeout(() => {
          onCancel()
        }, 1500)
      }
    }
  }

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h2>🔒 Admin Access Required</h2>
          <p>Enter admin password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-modal-form">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password..."
            className="admin-modal-input"
            autoFocus
            maxLength={20}
          />

          {error && <p className="admin-modal-error">{error}</p>}

          <div className="admin-modal-buttons">
            <button type="submit" className="admin-modal-btn admin-modal-btn-submit">
              🔓 Submit
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="admin-modal-btn admin-modal-btn-cancel"
            >
              Cancel
            </button>
          </div>
        </form>

        <p className="admin-modal-hint">
          Hint: Check the admin documentation
        </p>
      </div>
    </div>
  )
}
