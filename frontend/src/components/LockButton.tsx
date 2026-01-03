import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface LockButtonProps {
  onLock: () => void
}

function LockButton({ onLock }: LockButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleLock = async () => {
    setLoading(true)
    try {
      await invoke('lock_vault')
      onLock()
    } catch (error) {
      console.error('Failed to lock vault:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleLock} className="lock-button" disabled={loading}>
      {loading ? 'Locking...' : '🔒 Lock Vault'}
    </button>
  )
}

export default LockButton
