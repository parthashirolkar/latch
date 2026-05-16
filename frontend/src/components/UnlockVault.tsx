import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { api } from '../api/client'

interface UnlockVaultProps {
  onSuccess: () => void
}

function UnlockVault({ onSuccess }: UnlockVaultProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length === 0) {
      setError('Password cannot be empty')
      return
    }

    setLoading(true)
    try {
      await api.accessPassword(password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 flex flex-col bg-theme-bg border-2 border-theme-accent shadow-theme-sm m-4">
      <div className="flex flex-col gap-4">
        <h2 className="text-[28px] leading-[1.1] font-extrabold font-theme text-theme-text">Unlock Vault</h2>
        <p className="text-sm text-theme-text-secondary font-theme">Enter your master password to access your credentials</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-xs text-theme-text-secondary font-theme uppercase tracking-wider">Master Password</label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full bg-theme-bg text-theme-text border-2 border-theme-accent font-password px-3 py-2 outline-none focus:border-theme-accent [padding-right:40px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 bg-transparent border-none cursor-pointer p-1 text-theme-text-secondary"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <div className="p-3 bg-theme-danger text-theme-text text-sm">{error}</div>}

          <button type="submit" disabled={loading} className="bg-theme-accent text-theme-bg font-bold border-2 border-theme-bg px-4 py-2 cursor-pointer hover:bg-theme-text shadow-theme-sm disabled:opacity-50 disabled:cursor-not-allowed font-theme uppercase tracking-wider">
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default UnlockVault



