import { useState } from 'react'
import { Lock } from 'lucide-react'
import { api } from '../api/client'

interface LockButtonProps {
  onLock: () => void
}

function LockButton({ onLock }: LockButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleLock = async () => {
    setLoading(true)
    try {
      await api.lockVault()
      onLock()
    } catch (error) {
      console.error('Failed to lock vault:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleLock} disabled={loading} className="bg-theme-accent text-theme-bg font-bold border-2 border-theme-bg px-4 py-2 cursor-pointer hover:bg-theme-text shadow-theme-sm disabled:opacity-50 disabled:cursor-not-allowed font-theme uppercase tracking-wider">
      {loading ? 'Locking...' : <><Lock size={16} className="inline-block mr-1.5" /> Lock Vault</>}
    </button>
  )
}

export default LockButton



