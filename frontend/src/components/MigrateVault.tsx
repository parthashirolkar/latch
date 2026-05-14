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
      <div className="px-4 py-6 flex flex-col gap-4 bg-brutal-black">
        <div className="text-center mb-2">
          <h2 className="text-[28px] leading-[1.1] font-extrabold font-mono text-brutal-white">Migrate to Google Sign-In</h2>
          <p className="text-sm text-white/80 font-mono">Enter your current master password to decrypt your vault</p>
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
          className="flex items-center justify-center gap-2 px-6 py-3 bg-brutal-yellow text-brutal-black border-2 border-brutal-yellow font-extrabold font-mono uppercase tracking-wider cursor-pointer transition-all duration-100 shadow-[4px_4px_0px_var(--color-brutal-yellow)] hover:bg-brutal-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brutal-yellow)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:bg-brutal-gray disabled:cursor-not-allowed"
        >
          <span>Continue</span>
          <ArrowRight size={16} />
        </button>

        <div className="text-center mt-2">
          <p className="text-xs text-brutal-gray font-mono">This is a one-time migration. After completion, you'll use Google Sign-In.</p>
        </div>
      </div>
    )
  }

  if (step === 'oauth') {
    return (
      <div className="px-4 py-6 flex flex-col gap-4 bg-brutal-black">
        <div className="text-center mb-2">
          <h2 className="text-[28px] leading-[1.1] font-extrabold font-mono text-brutal-white">Connect Google Account</h2>
          <p className="text-sm text-white/80 font-mono">Sign in with Google to complete the migration</p>
        </div>

        <button
          onClick={handleOAuthSignIn}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2.5 px-6 py-3 bg-brutal-black text-brutal-white border-2 border-brutal-yellow font-extrabold font-mono uppercase tracking-wider cursor-pointer transition-all duration-100 w-full max-w-[300px] mx-auto shadow-[4px_4px_0px_var(--color-brutal-yellow)] hover:bg-[#222] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brutal-yellow)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Globe size={20} />
          <span>Sign in with Google</span>
        </button>

        <div className="text-center mt-2">
          <p className="text-xs text-brutal-gray font-mono">Your vault will be re-encrypted with your Google identity</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-10 flex flex-col items-center gap-3 text-center bg-brutal-black">
      <Loader2 size={32} className="animate-spin text-brutal-yellow" />
      <p className="text-base font-medium text-brutal-white">Migrating your vault...</p>
      <span className="text-sm text-white/80">Please don't close the app</span>
    </div>
  )
}
