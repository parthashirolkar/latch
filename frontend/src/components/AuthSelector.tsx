import { useState, useEffect } from 'react'
import { Chrome, Fingerprint } from 'lucide-react'
import { checkStatus } from '@choochmeque/tauri-plugin-biometry-api'

interface AuthSelectorProps {
  onOAuthSelect: () => void
  onBiometricSelect: () => void
}

function getBiometricLabel(biometryType: number): string {
  switch (biometryType) {
    case 1:
      return 'Touch ID'
    case 2:
      return 'Face ID'
    case 3:
      return 'Iris'
    case 4:
      return 'Windows Hello'
    default:
      return 'Biometric'
  }
}

export default function AuthSelector({
  onOAuthSelect,
  onBiometricSelect
}: AuthSelectorProps) {
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricLabel, setBiometricLabel] = useState('Biometric')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const check = async () => {
      try {
        const status = await checkStatus()
        setBiometricAvailable(status.isAvailable)
        setBiometricLabel(getBiometricLabel(status.biometryType ?? 0))
      } catch {
        setBiometricAvailable(false)
      } finally {
        setLoading(false)
      }
    }
    check()
  }, [])

  return (
    <div className="oauth-signin-container">
      <div className="oauth-header">
        <h2>Welcome to Latch</h2>
        <p>Choose your authentication method:</p>
      </div>

      <div className="auth-selector-buttons">
        <button
          onClick={onOAuthSelect}
          className="oauth-button auth-selector-button"
        >
          <Chrome size={24} />
          <span>Sign in with Google</span>
          <span className="auth-selector-subtitle">Use your Google account</span>
        </button>

        <button
          onClick={onBiometricSelect}
          disabled={!biometricAvailable || loading}
          className="oauth-button biometric-button auth-selector-button"
          title={
            !biometricAvailable
              ? 'Windows Hello or biometric is not configured on this device'
              : undefined
          }
        >
          <Fingerprint size={24} />
          <span>Use {biometricLabel}</span>
          <span className="auth-selector-subtitle">
            {biometricAvailable
              ? 'Use fingerprint or face'
              : 'Not available on this device'}
          </span>
        </button>
      </div>

      <div className="oauth-footer">
        <p>Your vault will be encrypted and stored locally. No backup available.</p>
      </div>
    </div>
  )
}
