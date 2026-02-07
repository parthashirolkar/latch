import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { signIn } from '@choochmeque/tauri-plugin-google-auth-api'
import { checkStatus } from '@choochmeque/tauri-plugin-biometry-api'
import {
  generateAndStoreKey,
  clearStoredKey
} from '../utils/biometricKeys'

interface AuthPreferences {
  auth_method: string
  session_valid: boolean
  session_remaining_seconds: number
}

function getAuthMethodLabel(authMethod: string): string {
  switch (authMethod) {
    case 'oauth-pbkdf2':
      return 'Google OAuth'
    case 'biometric-keychain':
      return 'Windows Hello'
    default:
      return authMethod || 'Unknown'
  }
}

function Settings() {
  const [preferences, setPreferences] = useState<AuthPreferences>({
    auth_method: 'none',
    session_valid: false,
    session_remaining_seconds: 0
  })
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      setLoading(true)
      setError('')

      const prefsResult = await invoke('get_auth_preferences')
      const prefs = JSON.parse(prefsResult as string)

      setPreferences({
        auth_method: prefs.auth_method ?? 'none',
        session_valid: prefs.session_valid ?? false,
        session_remaining_seconds: prefs.session_remaining_seconds ?? 0
      })

      const status = await checkStatus()
      setBiometricAvailable(status.isAvailable)
    } catch (err) {
      console.error('Failed to load preferences:', err)
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchToBiometric = async () => {
    if (!preferences.session_valid) {
      setError('Vault must be unlocked to switch. Please unlock first.')
      return
    }
    if (!biometricAvailable) {
      setError('Windows Hello is not configured on this device.')
      return
    }

    const confirmed = window.confirm(
      'This will re-encrypt your vault with Windows Hello. Continue?'
    )
    if (!confirmed) return

    setSwitching(true)
    setError('')
    try {
      const keyHex = await generateAndStoreKey()
      await invoke('reencrypt_vault', {
        newKeyHex: keyHex,
        newKdf: 'biometric-keychain',
        newSalt: ''
      })
      await loadPreferences()
    } catch (err) {
      console.error('Failed to switch to biometric:', err)
      setError(String(err))
    } finally {
      setSwitching(false)
    }
  }

  const handleSwitchToOAuth = async () => {
    if (!preferences.session_valid) {
      setError('Vault must be unlocked to switch. Please unlock first.')
      return
    }

    const confirmed = window.confirm(
      'This will re-encrypt your vault with Google OAuth. Continue?'
    )
    if (!confirmed) return

    setSwitching(true)
    setError('')
    try {
      const response = await signIn({
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
        scopes: ['openid', 'email', 'profile'],
        successHtmlResponse:
          '<h1>Authentication successful! You can close this window.</h1>'
      })

      if (!response.idToken) {
        throw new Error('No ID token received from Google')
      }

      await invoke('reencrypt_vault_to_oauth', { idToken: response.idToken })
      await clearStoredKey()
      await loadPreferences()
    } catch (err) {
      console.error('Failed to switch to OAuth:', err)
      setError(String(err))
    } finally {
      setSwitching(false)
    }
  }

  const getSessionTimeRemaining = () => {
    if (!preferences.session_valid) return null
    const remaining = preferences.session_remaining_seconds
    if (remaining <= 0) return 'Expired'
    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60
    return `${minutes}m ${seconds}s`
  }

  if (loading) {
    return (
      <div className="settings-loading">
        <div className="settings-loading-spinner"></div>
        <span style={{ marginLeft: '12px' }}>Loading settings...</span>
      </div>
    )
  }

  const currentLabel = getAuthMethodLabel(preferences.auth_method)
  const canSwitchToBiometric =
    preferences.auth_method !== 'biometric-keychain' && biometricAvailable
  const canSwitchToOAuth = preferences.auth_method !== 'oauth-pbkdf2'

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Authentication Settings</h2>
        <p>Manage your authentication method</p>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <h3>Current Method</h3>
        </div>

        <div className="settings-item">
          <div className="settings-item-content">
            <div className="settings-item-label">
              Authentication: {currentLabel}
            </div>
            <div className="settings-item-description">
              {preferences.auth_method === 'biometric-keychain'
                ? 'Use your fingerprint or face to unlock'
                : 'Authenticate with your Google account'}
            </div>
            {preferences.session_valid && (
              <div className="settings-item-status">
                Session expires in {getSessionTimeRemaining()}
              </div>
            )}
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-content">
            <div className="settings-item-description">
              You can switch to a different authentication method below. Your
              vault will be re-encrypted with the new method.
            </div>
          </div>
          <div className="settings-toggle">
            {canSwitchToBiometric && (
              <button
                className="settings-button primary"
                onClick={handleSwitchToBiometric}
                disabled={switching}
              >
                {switching ? '...' : 'Switch to Windows Hello'}
              </button>
            )}
            {canSwitchToOAuth && (
              <button
                className="settings-button primary"
                onClick={handleSwitchToOAuth}
                disabled={switching}
              >
                {switching ? '...' : 'Switch to Google OAuth'}
              </button>
            )}
          </div>
        </div>

        {!biometricAvailable && preferences.auth_method !== 'biometric-keychain' && (
          <div className="settings-item">
            <div className="settings-item-content">
              <div
                className="settings-item-label"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Windows Hello not available
              </div>
              <div className="settings-item-description">
                Your device does not support biometric authentication or it is
                not configured
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <h3>About</h3>
        </div>
        <div className="settings-item">
          <div className="settings-item-content">
            <div className="settings-item-description">
              Your vault is encrypted and stored locally. There is no backup.
              If you lose access to your chosen authentication method, your
              vault cannot be recovered.
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            background: 'var(--error-bg)',
            color: 'var(--error-text)',
            borderRadius: '4px',
            fontSize: 'var(--font-sm)'
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

export default Settings
