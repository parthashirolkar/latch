import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { checkStatus } from '@choochmeque/tauri-plugin-biometry-api'

interface AuthPreferences {
  biometric_enabled: boolean
  session_valid: boolean | null
  session_remaining_seconds: number
}

function Settings() {
  const [preferences, setPreferences] = useState<AuthPreferences>({
    biometric_enabled: false,
    session_valid: null,
    session_remaining_seconds: 0
  })
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enablingBiometric, setEnablingBiometric] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      setLoading(true)
      
      const prefsResult = await invoke('get_auth_preferences')
      const prefs = JSON.parse(prefsResult as string)
      
      setPreferences({
        biometric_enabled: prefs.biometric_enabled,
        session_valid: prefs.session_valid,
        session_remaining_seconds: prefs.session_remaining_seconds
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

  const handleEnableBiometric = async () => {
    try {
      setEnablingBiometric(true)
      setError('')
      
      await invoke('enable_biometric_unlock')
      
      await loadPreferences()
    } catch (err) {
      console.error('Failed to enable biometric:', err)
      setError(err as string)
    } finally {
      setEnablingBiometric(false)
    }
  }

  const handleDisableBiometric = async () => {
    try {
      setEnablingBiometric(true)
      setError('')
      
      await invoke('disable_biometric_unlock')
      
      await loadPreferences()
    } catch (err) {
      console.error('Failed to disable biometric:', err)
      setError(err as string)
    } finally {
      setEnablingBiometric(false)
    }
  }

  const getSessionTimeRemaining = () => {
    if (!preferences.session_valid) {
      return null
    }
    
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

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Authentication Settings</h2>
        <p>Manage your authentication preferences</p>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <h3>Authentication Method</h3>
        </div>

        <div className="settings-item">
          <div className="settings-item-content">
            <div className="settings-item-label">
              {preferences.biometric_enabled ? '✅ Biometric Enabled' : '🔐 OAuth Only'}
            </div>
            <div className="settings-item-description">
              {preferences.biometric_enabled 
                ? 'Use your fingerprint or face to unlock quickly' 
                : 'Authenticate with your Google account each time'}
            </div>
            {preferences.biometric_enabled && preferences.session_valid !== null && (
              <div className="settings-item-status">
                ⏱️ Session expires in {getSessionTimeRemaining()}
              </div>
            )}
          </div>
          
          <div className="settings-toggle">
            {preferences.biometric_enabled ? (
              <button
                className="settings-button danger"
                onClick={handleDisableBiometric}
                disabled={enablingBiometric}
              >
                {enablingBiometric ? '...' : 'Disable'}
              </button>
            ) : (
              <button
                className="settings-button primary"
                onClick={handleEnableBiometric}
                disabled={enablingBiometric || !biometricAvailable}
              >
                {enablingBiometric ? '...' : 'Enable'}
              </button>
            )}
          </div>
        </div>

        {!biometricAvailable && !preferences.biometric_enabled && (
          <div className="settings-item">
            <div className="settings-item-content">
              <div className="settings-item-label" style={{ color: 'var(--text-tertiary)' }}>
                ⚠️ Biometric not available
              </div>
              <div className="settings-item-description">
                Your device doesn't support biometric authentication or it's not set up
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
              Biometric authentication stores your OAuth token securely in your system keychain. 
              You'll need to re-authenticate with OAuth every 30 minutes for security. 
              Biometric is just a convenience layer - OAuth remains your primary authentication method.
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ 
          marginTop: '12px', 
          padding: '12px', 
          background: 'var(--error-bg)', 
          color: 'var(--error-text)', 
          borderRadius: '4px',
          fontSize: 'var(--font-sm)'
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

export default Settings
