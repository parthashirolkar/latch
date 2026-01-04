import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface SetupVaultProps {
  onSuccess: () => void
}

function SetupVault({ onSuccess }: SetupVaultProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      const result = await invoke('init_vault', { password })
      const response = JSON.parse(result as string)

      if (response.status === 'success') {
        onSuccess()
      } else {
        setError(response.message || 'Failed to initialize vault')
      }
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="setup-container">
      <div className="setup-form">
        <h2>Create Vault</h2>
        <p>Set up your master password to secure your credentials</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Master Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="form-button" disabled={loading}>
            {loading ? 'Creating...' : 'Create Vault'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SetupVault
