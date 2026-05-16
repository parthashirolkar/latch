import { Lock, Globe, Loader2, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { signIn } from '@choochmeque/tauri-plugin-google-auth-api'
import { api } from '../api/client'
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
      const response = await signIn({
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
        scopes: ['openid', 'email', 'profile'],
        successHtmlResponse: '<h1>Authentication successful! You can close this window.</h1>'
      })

      if (!response.idToken) {
        throw new Error('No ID token received from Google')
      }

      await api.migrateToOAuth(password, response.idToken)
      onSuccess()
    } catch (err) {
      onError?.(String(err))
      setStep('password')
    } finally {
      setIsProcessing(false)
    }
  }

  if (step === 'password') {
    return (
      <div className="px-4 py-6 flex flex-col gap-4 bg-theme-bg">
        <div className="text-center mb-2">
          <h2 className="text-[28px] leading-[1.1] font-extrabold font-theme text-theme-text">Migrate to Google Sign-In</h2>
          <p className="text-sm text-theme-text-secondary font-theme">Enter your current master password to decrypt your vault</p>
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
          className="flex items-center justify-center gap-2 px-6 py-3 bg-theme-accent text-theme-bg border-2 border-theme-accent font-extrabold font-theme uppercase tracking-wider cursor-pointer transition-all duration-100 shadow-theme-sm hover:bg-theme-text hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:bg-theme-text-secondary disabled:cursor-not-allowed"
        >
          <span>Continue</span>
          <ArrowRight size={16} />
        </button>

        <div className="text-center mt-2">
          <p className="text-xs text-theme-text-secondary font-theme">This is a one-time migration. After completion, you'll use Google Sign-In.</p>
        </div>
      </div>
    )
  }

  if (step === 'oauth') {
    return (
      <div className="px-4 py-6 flex flex-col gap-4 bg-theme-bg">
        <div className="text-center mb-2">
          <h2 className="text-[28px] leading-[1.1] font-extrabold font-theme text-theme-text">Connect Google Account</h2>
          <p className="text-sm text-theme-text-secondary font-theme">Sign in with Google to complete the migration</p>
        </div>

        <button
          onClick={handleOAuthSignIn}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2.5 px-6 py-3 bg-theme-bg text-theme-text border-2 border-theme-accent font-extrabold font-theme uppercase tracking-wider cursor-pointer transition-all duration-100 w-full max-w-[300px] mx-auto shadow-theme-sm hover:bg-theme-surface hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Globe size={20} />
          <span>Sign in with Google</span>
        </button>

        <div className="text-center mt-2">
          <p className="text-xs text-theme-text-secondary font-theme">Your vault will be re-encrypted with your Google identity</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-10 flex flex-col items-center gap-3 text-center bg-theme-bg">
      <Loader2 size={32} className="animate-spin text-theme-accent" />
      <p className="text-base font-medium text-theme-text">Migrating your vault...</p>
      <span className="text-sm text-theme-text-secondary">Please don't close the app</span>
    </div>
  )
}



