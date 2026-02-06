import { Chrome, Loader2, Fingerprint } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useState } from 'react'
import { signIn } from '@choochmeque/tauri-plugin-google-auth-api'
import { authenticate } from '@choochmeque/tauri-plugin-biometry-api'

interface OAuthSignInProps {
  mode: 'setup' | 'login'
  onSuccess: () => void
  onError?: (error: string) => void
  biometricEnabled?: boolean
}

export default function OAuthSignIn({ mode, onSuccess, onError, biometricEnabled }: OAuthSignInProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isBiometricProcessing, setIsBiometricProcessing] = useState(false)

  const handleBiometricUnlock = async () => {
    if (mode !== 'login') return
    
    setIsBiometricProcessing(true)
    try {
      await authenticate('Unlock Latch')
      await invoke('unlock_with_biometric_key')
      onSuccess()
    } catch (error) {
      console.error('Biometric unlock failed:', error)
      onError?.('Biometric authentication failed')
    } finally {
      setIsBiometricProcessing(false)
    }
  }

  const handleSignIn = async () => {
    setIsProcessing(true)
    try {
      // Sign in with Google using the plugin
      const response = await signIn({
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
        scopes: ['openid', 'email', 'profile'],
        successHtmlResponse: '<h1>Authentication successful! You can close this window.</h1>'
      })

      if (!response.idToken) {
        throw new Error('No ID token received from Google')
      }

      // Call appropriate backend command based on mode
      const command = mode === 'setup' ? 'init_vault_oauth' : 'unlock_vault_oauth'
      const result = await invoke(command, { idToken: response.idToken })
      const parsed = JSON.parse(result as string)

      if (parsed.status === 'success') {
        onSuccess()
      } else {
        onError?.(parsed.message || 'Authentication failed')
      }
    } catch (err) {
      onError?.(String(err))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="oauth-signin-container">
      <div className="oauth-header">
        {mode === 'setup' ? (
          <>
            <h2>Welcome to Latch</h2>
            <p>Sign in with Google to secure your password vault</p>
          </>
        ) : (
          <>
            <h2>Unlock Latch</h2>
            <p>Sign in with Google to access your passwords</p>
          </>
        )}
      </div>

      {biometricEnabled && mode === 'login' ? (
        <>
          <button
            onClick={handleBiometricUnlock}
            disabled={isBiometricProcessing}
            className="oauth-button biometric-button"
          >
            {isBiometricProcessing ? (
              <>
                <Loader2 size={20} className="spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <Fingerprint size={20} />
                <span>Unlock with Biometric</span>
              </>
            )}
          </button>
          
          <div className="oauth-divider">
            <span>or</span>
          </div>
        </>
      ) : null}

      <button
        onClick={handleSignIn}
        disabled={isProcessing}
        className="oauth-button"
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="spin" />
            <span>Authenticating...</span>
          </>
        ) : (
          <>
            <Chrome size={20} />
            <span>Sign in with Google</span>
          </>
        )}
      </button>

      <div className="oauth-footer">
        <p>Your vault will be encrypted and stored locally</p>
      </div>
    </div>
  )
}
