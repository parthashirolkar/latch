import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { api } from '../api/client'

interface SetupVaultProps {
  onSuccess: () => void
}

function SetupVault({ onSuccess }: SetupVaultProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length === 0) {
      setError('Password cannot be empty')
      return
    }

    setLoading(true)
    try {
      await api.provisionPassword(password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 flex flex-col bg-brutal-black border-2 border-brutal-yellow shadow-[4px_4px_0px_var(--color-brutal-yellow)] m-4">
      <div className="flex flex-col gap-4">
        <h2 className="text-[28px] leading-[1.1] font-extrabold font-mono text-brutal-white">Create Vault</h2>
        <p className="text-sm text-white/80 font-mono">Set up your master password to secure your credentials</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-xs text-brutal-gray font-mono uppercase tracking-wider">Master Password</label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full bg-brutal-black text-brutal-white border-2 border-brutal-yellow font-mono px-3 py-2 outline-none focus:border-brutal-blue [padding-right:40px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 bg-transparent border-none cursor-pointer p-1 text-brutal-gray"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="confirm-password" className="text-xs text-brutal-gray font-mono uppercase tracking-wider">Confirm Password</label>
            <div className="relative flex items-center">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-brutal-black text-brutal-white border-2 border-brutal-yellow font-mono px-3 py-2 outline-none focus:border-brutal-blue [padding-right:40px]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 bg-transparent border-none cursor-pointer p-1 text-brutal-gray"
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <div className="p-3 bg-brutal-red text-brutal-white text-sm">{error}</div>}

          <button type="submit" disabled={loading} className="bg-brutal-yellow text-brutal-black font-bold border-2 border-brutal-black px-4 py-2 cursor-pointer hover:bg-brutal-white shadow-[3px_3px_0px_var(--color-brutal-black)] disabled:opacity-50 disabled:cursor-not-allowed font-mono uppercase tracking-wider">
            {loading ? 'Creating...' : 'Create Vault'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SetupVault
