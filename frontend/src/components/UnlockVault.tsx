import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'

const ResponseSchema = z.object({
  status: z.string(),
  message: z.string().optional()
})

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
      const result = await invoke('unlock_vault', { password })
      const response = ResponseSchema.parse(JSON.parse(result as string))

      if (response.status === 'success') {
        onSuccess()
      } else {
        setError(response.message || 'Failed to unlock vault')
      }
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="unlock-container">
      <div className="unlock-form">
        <h2>Unlock Vault</h2>
        <p>Enter your master password to access your credentials</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Master Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                autoFocus
                style={{ paddingRight: '40px', flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#888'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="form-button" disabled={loading}>
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default UnlockVault
