import { Lock, Chrome, Loader2, ArrowRight } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useState } from 'react'
import { signIn } from '@choochmeque/tauri-plugin-google-auth-api'
import PaletteInput from './PaletteInput'

interface MigrateVaultProps {
  onSuccess: () => void
  onError?: (error: string) => void
}

export default function MigrateVault({ onSuccess, onError }: MigrateVaultProps) {
  const [step, setStep] = useState<'password' | 'oauth' | 'processing'>('password')
  const [password, setPassword] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handlePasswordSubmit = () => {
    if (password.length === 0) {
      onError?.('Password cannot be empty')
      return
    }
    setStep('oauth')
  }

  const handleOAuthSignIn = async () => {
    setStep('processing')
    setIsProcessing(true)
    try {
      // Sign in with Google
      const response = await signIn({
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
        scopes: ['openid', 'email', 'profile'],
        successHtmlResponse: '<h1>Authentication successful! You can close this window.</h1>'
      })

      if (!response.idToken) {
        throw new Error('No ID token received from Google')
      }

      // Migrate vault from password to OAuth
      const result = await invoke('migrate_to_oauth', { 
        password,
        idToken: response.idToken 
      })
      const parsed = JSON.parse(result as string)

      if (parsed.status === 'success') {
        onSuccess()
      } else {
        onError?.(parsed.message || 'Migration failed')
        setStep('password')
      }
    } catch (err) {
      onError?.(String(err))
      setStep('password')
    } finally {
      setIsProcessing(false)
    }
  }

  if (step === 'password') {
    return (
      <div className="migrate-container">
        <div className="migrate-header">
          <h2>Migrate to Google Sign-In</h2>
          <p>Enter your current master password to decrypt your vault</p>
        </div>

        <PaletteInput
          value={password}
          onChange={setPassword}
          onSubmit={handlePasswordSubmit}
          placeholder="Enter master password..."
          type="password"
          icon={Lock}
          autoFocus={true}
        />

        <button
          onClick={handlePasswordSubmit}
          disabled={password.length === 0}
          className="migrate-button"
        >
          <span>Continue</span>
          <ArrowRight size={16} />
        </button>

        <div className="migrate-info">
          <p>This is a one-time migration. After completion, you'll use Google Sign-In.</p>
        </div>
      </div>
    )
  }

  if (step === 'oauth') {
    return (
      <div className="migrate-container">
        <div className="migrate-header">
          <h2>Connect Google Account</h2>
          <p>Sign in with Google to complete the migration</p>
        </div>

        <button
          onClick={handleOAuthSignIn}
          disabled={isProcessing}
          className="oauth-button"
        >
          <Chrome size={20} />
          <span>Sign in with Google</span>
        </button>

        <div className="migrate-info">
          <p>Your vault will be re-encrypted with your Google identity</p>
        </div>
      </div>
    )
  }

  return (
    <div className="migrate-container">
      <div className="migrate-processing">
        <Loader2 size={32} className="spin" />
        <p>Migrating your vault...</p>
        <span>Please don't close the app</span>
      </div>
    </div>
  )
}
