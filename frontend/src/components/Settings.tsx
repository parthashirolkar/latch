import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { check } from '@tauri-apps/plugin-updater'
import { ask, message } from '@tauri-apps/plugin-dialog'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { signIn } from '@choochmeque/tauri-plugin-google-auth-api'
import { checkStatus } from '@choochmeque/tauri-plugin-biometry-api'
import {
  generateAndStoreKey,
  clearStoredKey
} from '../utils/biometricKeys'
import ConfirmationModal from './ConfirmationModal'

type AuthMethod = 'oauth-pbkdf2' | 'oauth-argon2id' | 'biometric-keychain'

interface AuthPreferences {
  auth_method: string
  session_valid: boolean
  session_remaining_seconds: number
}

function getAuthMethodLabel(authMethod: string): string {
  switch (authMethod) {
    case 'oauth-pbkdf2':
    case 'oauth-argon2id':
      return 'Google OAuth'
    case 'biometric-keychain':
      return 'Biometric Authentication'
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
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod>('oauth-pbkdf2')
  const [liveRemainingSeconds, setLiveRemainingSeconds] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<{
    message: string
    onConfirm: () => void
  } | null>(null)
  const [appVersion, setAppVersion] = useState<string>('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{
    version: string
    body: string
    date: string
  } | null>(null)

  useEffect(() => {
    loadPreferences()
    loadVersion()
  }, [])

  useEffect(() => {
    if (liveRemainingSeconds === null || liveRemainingSeconds <= 0) return
    const interval = setInterval(() => {
      setLiveRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) return 0
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [liveRemainingSeconds])

  const loadPreferences = async () => {
    try {
      setLoading(true)
      setError('')

      const prefsResult = await invoke('get_auth_preferences')
      const prefs = JSON.parse(prefsResult as string)

      const authMethod = prefs.auth_method ?? 'none'
      const sessionValid = prefs.session_valid ?? false
      const remaining = prefs.session_remaining_seconds ?? 0
      setPreferences({
        auth_method: authMethod,
        session_valid: sessionValid,
        session_remaining_seconds: remaining
      })
      setLiveRemainingSeconds(sessionValid && remaining > 0 ? remaining : null)
      setSelectedMethod(
        authMethod === 'biometric-keychain' ? 'biometric-keychain' : authMethod === 'oauth-argon2id' ? 'oauth-argon2id' : 'oauth-pbkdf2'
      )

      const status = await checkStatus()
      setBiometricAvailable(status.isAvailable)
    } catch (err) {
      console.error('Failed to load preferences:', err)
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const loadVersion = async () => {
    try {
      const version = await getVersion()
      setAppVersion(version)
    } catch (err) {
      console.error('Failed to get version:', err)
    }
  }

  const checkForUpdates = async () => {
    try {
      setCheckingUpdate(true)
      setError('')
      
      const update = await check()
      
      if (update?.available) {
        setUpdateAvailable(true)
        setUpdateInfo({
          version: update.version || 'Unknown',
          body: update.body || 'No release notes available.',
          date: update.date || ''
        })
        
        const shouldUpdate = await ask(
          `Version ${update.version} is available. You're currently on version ${appVersion}. \n\nRelease notes:\n${update.body}\n\nWould you like to install this update?`,
          { title: 'Update Available', kind: 'info' }
        )
        
        if (shouldUpdate) {
          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                break
              case 'Progress':
                break
              case 'Finished':
                break
            }
          })
          
          await message('Update downloaded successfully! The app will now restart to install the update.', { kind: 'info' })
          await relaunch()
        }
      } else {
        setUpdateAvailable(false)
        await message(`You're already on the latest version (${appVersion}).`, { title: 'Up to Date', kind: 'info' })
      }
    } catch (err) {
      console.error('Failed to check for updates:', err)
      setUpdateAvailable(false)
      await message(`You're already on the latest version (${appVersion}).`, { title: 'Up to Date', kind: 'info' })
    } finally {
      setCheckingUpdate(false)
    }
  }

  const hasChanges = selectedMethod !== preferences.auth_method

  const validateOAuthConfig = (): string | null => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET
    if (
      !clientId ||
      !clientSecret ||
      clientId === 'your-client-id-here' ||
      clientSecret === 'your-client-secret-here'
    ) {
      return 'Google OAuth is not configured. Add VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_SECRET to your .env file.'
    }
    return null
  }

  const handleSave = () => {
    if (!hasChanges) return
    if (!preferences.session_valid) {
      setError('Vault must be unlocked to switch. Please unlock first.')
      return
    }
    if (selectedMethod === 'biometric-keychain') {
      if (!biometricAvailable) {
        setError('Biometric authentication is not configured on this device.')
        return
      }
      setConfirmation({
        message:
          'This will re-encrypt your vault with biometric authentication. Continue?',
        onConfirm: performSwitchToBiometric
      })
    } else {
      const oauthError = validateOAuthConfig()
      if (oauthError) {
        setError(oauthError)
        return
      }
      setConfirmation({
        message: 'This will re-encrypt your vault with Google OAuth. Continue?',
        onConfirm: performSwitchToOAuth
      })
    }
  }

  const performSwitchToBiometric = async () => {
    setConfirmation(null)
    setSwitching(true)
    setError('')
    try {
      const keyHex = await generateAndStoreKey()
      try {
        await invoke('reencrypt_vault', {
          newKeyHex: keyHex,
          newKdf: 'biometric-keychain',
          newSalt: ''
        })
        await loadPreferences()
      } catch (reencryptErr) {
        await clearStoredKey()
        throw reencryptErr
      }
    } catch (err) {
      console.error('Failed to switch to biometric:', err)
      setError(String(err))
    } finally {
      setSwitching(false)
    }
  }

  const performSwitchToOAuth = async () => {
    setConfirmation(null)
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

  const handleCancel = () => {
    setSelectedMethod(
      preferences.auth_method === 'biometric-keychain'
        ? 'biometric-keychain'
        : 'oauth-pbkdf2'
    )
    setError('')
  }

  const getSessionTimeRemaining = () => {
    if (!preferences.session_valid) return null
    const remaining =
      liveRemainingSeconds !== null ? liveRemainingSeconds : preferences.session_remaining_seconds
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

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h2>Authentication</h2>
        <div className="settings-header-meta">
          <span className="settings-current-badge">{currentLabel}</span>
          {preferences.session_valid && (
            <span className="settings-session-timer">
              {getSessionTimeRemaining()}
            </span>
          )}
        </div>
      </header>

      <div className="settings-body">
        <p className="settings-instruction">
          Choose how you unlock your vault. Switching re-encrypts your data.
        </p>

        <div className="settings-radio-group">
          <label
            className={`settings-radio-option ${selectedMethod === 'biometric-keychain' ? 'selected' : ''} ${!biometricAvailable ? 'disabled' : ''}`}
          >
            <input
              type="radio"
              name="auth-method"
              value="biometric-keychain"
              checked={selectedMethod === 'biometric-keychain'}
              onChange={() => setSelectedMethod('biometric-keychain')}
              disabled={!biometricAvailable || switching}
            />
            <span className="settings-radio-label">Biometric</span>
            <span className="settings-radio-description">
              Fingerprint or face
            </span>
          </label>
          <label
            className={`settings-radio-option ${selectedMethod === 'oauth-pbkdf2' || selectedMethod === 'oauth-argon2id' ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name="auth-method"
              value="oauth-pbkdf2"
              checked={selectedMethod === 'oauth-pbkdf2' || selectedMethod === 'oauth-argon2id'}
              onChange={() => setSelectedMethod('oauth-pbkdf2')}
              disabled={switching}
            />
            <span className="settings-radio-label">Google OAuth</span>
            <span className="settings-radio-description">
              Sign in with Google
            </span>
          </label>
        </div>

        {hasChanges && (
          <div className="settings-actions">
            <button
              className="settings-button settings-button-ghost"
              onClick={handleCancel}
              disabled={switching}
            >
              Cancel
            </button>
            <button
              className="settings-button settings-button-primary"
              onClick={handleSave}
              disabled={switching}
            >
              {switching ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        {!biometricAvailable && preferences.auth_method !== 'biometric-keychain' && (
          <p className="settings-hint">
            Biometric authentication is not available on this device.
          </p>
        )}

        <p className="settings-footnote">
          Vault is encrypted locally. No backup. Lost access = lost data.
        </p>
      </div>

      <div className="settings-section" style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
        <header className="settings-header" style={{ marginBottom: '16px' }}>
          <h2>Updates</h2>
          <div className="settings-header-meta">
            <span className="settings-current-badge">v{appVersion}</span>
          </div>
        </header>
        <div className="settings-body">
          <p className="settings-instruction" style={{ marginBottom: '12px' }}>
            Check for updates to get the latest features and security improvements.
          </p>
          <button
            className="settings-button settings-button-primary"
            onClick={checkForUpdates}
            disabled={checkingUpdate || switching}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {checkingUpdate ? 'Checking…' : 'Check for Updates'}
          </button>
          {updateAvailable && updateInfo && (
            <div className="settings-update-info" style={{ marginTop: '12px', padding: '12px', background: 'var(--highlight-bg)', borderRadius: '8px', fontSize: '14px' }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Update Available: v{updateInfo.version}</div>
              <div style={{ opacity: 0.8 }}>{updateInfo.body}</div>
            </div>
          )}
        </div>
      </div>

      {error && <div className="settings-error">{error}</div>}
      {confirmation && (
        <ConfirmationModal
          message={confirmation.message}
          onConfirm={confirmation.onConfirm}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </div>
  )
}

export default Settings
