import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Fingerprint, Loader2 } from 'lucide-react'
import {
  generateAndStoreKey,
  retrieveKey
} from '../utils/biometricKeys'

interface BiometricSignInProps {
  mode: 'setup' | 'login'
  onSuccess: () => void
  onError?: (error: string) => void
}

export default function BiometricSignIn({
  mode,
  onSuccess,
  onError
}: BiometricSignInProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSetup = async () => {
    setIsProcessing(true)
    try {
      const keyHex = await generateAndStoreKey()
      const result = await invoke('init_vault_with_key', {
        keyHex,
        kdf: 'biometric-keychain'
      })
      const parsed = JSON.parse(result as string)
      if (parsed.status === 'success') {
        onSuccess()
      } else {
        onError?.(parsed.message || 'Failed to set up vault')
      }
    } catch (err) {
      onError?.(String(err))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleLogin = async () => {
    setIsProcessing(true)
    try {
      const keyHex = await retrieveKey()
      const result = await invoke('unlock_vault_with_key', { keyHex })
      const parsed = JSON.parse(result as string)
      if (parsed.status === 'success') {
        onSuccess()
      } else {
        onError?.(parsed.message || 'Failed to unlock vault')
      }
    } catch (err) {
      onError?.(String(err))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClick = mode === 'setup' ? handleSetup : handleLogin

  return (
    <div className="oauth-signin-container">
      <div className="oauth-header">
        {mode === 'setup' ? (
          <>
            <h2>Set up Biometric Authentication</h2>
            <p>Use your fingerprint or face to protect your vault</p>
          </>
        ) : (
          <>
            <h2>Unlock Latch</h2>
          </>
        )}
      </div>

      <button
        onClick={handleClick}
        disabled={isProcessing}
        className="oauth-button biometric-button"
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="spin" />
            <span>Authenticating...</span>
          </>
        ) : (
          <>
            <Fingerprint size={20} />
            <span>
              {mode === 'setup' ? 'Set up and Create Vault' : 'Unlock with Biometric'}
            </span>
          </>
        )}
      </button>

      <div className="oauth-footer">
        <p>Your vault is protected by biometric authentication</p>
      </div>
    </div>
  )
}
