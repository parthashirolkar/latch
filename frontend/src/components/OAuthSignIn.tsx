import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { signIn } from '@choochmeque/tauri-plugin-google-auth-api'
import { api } from '../api/client'
import { Google } from './ui/svgs/google'

interface OAuthSignInProps {
  mode: 'setup' | 'login'
  onSuccess: () => void
  onError?: (error: string) => void
}

export default function OAuthSignIn({ mode, onSuccess, onError }: OAuthSignInProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSignIn = async () => {
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

      if (mode === 'setup') {
        await api.provisionOAuth(response.idToken)
      } else {
        await api.accessOAuth(response.idToken)
      }
      onSuccess()
    } catch (err) {
      onError?.(String(err))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="px-5 py-6 flex flex-col items-center gap-4 bg-theme-bg">
      <div className="text-center">
        {mode === 'setup' ? (
          <>
            <h2 className="text-[28px] leading-[1.1] font-extrabold font-theme text-theme-text uppercase tracking-wider mb-1.5">Welcome to Latch</h2>
            <p className="text-sm text-theme-text-secondary font-theme">Sign in with Google to secure your password vault</p>
          </>
        ) : (
          <>
            <h2 className="text-[28px] leading-[1.1] font-extrabold font-theme text-theme-text uppercase tracking-wider mb-1.5">Unlock Latch</h2>
            <p className="text-sm text-theme-text-secondary font-theme">Sign in with Google to access your passwords</p>
          </>
        )}
      </div>

      <button
        onClick={handleSignIn}
        disabled={isProcessing}
        className="flex items-center justify-center gap-2.5 px-6 py-3 bg-theme-bg text-theme-text border-2 border-theme-accent font-extrabold font-theme uppercase tracking-wider cursor-pointer transition-all duration-100 w-full max-w-[300px] shadow-theme-sm hover:bg-theme-surface hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            <span>Authenticating...</span>
          </>
        ) : (
          <>
            <Google className="w-5 h-5 flex-shrink-0" />
            <span>Sign in with Google</span>
          </>
        )}
      </button>

      <div className="text-center border-t border-theme-border w-full pt-3">
        <p className="text-xs text-theme-text-secondary font-theme">Your vault will be encrypted and stored locally</p>
      </div>
    </div>
  )
}



