import { Globe, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { signIn } from '@choochmeque/tauri-plugin-google-auth-api'
import { api } from '../api/client'

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
    <div className="px-5 py-6 flex flex-col items-center gap-4 bg-brutal-black">
      <div className="text-center">
        {mode === 'setup' ? (
          <>
            <h2 className="text-[28px] leading-[1.1] font-extrabold font-mono text-brutal-white uppercase tracking-wider mb-1.5">Welcome to Latch</h2>
            <p className="text-sm text-white/80 font-mono">Sign in with Google to secure your password vault</p>
          </>
        ) : (
          <>
            <h2 className="text-[28px] leading-[1.1] font-extrabold font-mono text-brutal-white uppercase tracking-wider mb-1.5">Unlock Latch</h2>
            <p className="text-sm text-white/80 font-mono">Sign in with Google to access your passwords</p>
          </>
        )}
      </div>

      <button
        onClick={handleSignIn}
        disabled={isProcessing}
        className="flex items-center justify-center gap-2.5 px-6 py-3 bg-brutal-black text-brutal-white border-2 border-brutal-yellow font-extrabold font-mono uppercase tracking-wider cursor-pointer transition-all duration-100 w-full max-w-[300px] shadow-[4px_4px_0px_var(--color-brutal-yellow)] hover:bg-[#222] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brutal-yellow)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            <span>Authenticating...</span>
          </>
        ) : (
          <>
            <Globe size={20} />
            <span>Sign in with Google</span>
          </>
        )}
      </button>

      <div className="text-center border-t border-[#555] w-full pt-3">
        <p className="text-xs text-brutal-gray font-mono">Your vault will be encrypted and stored locally</p>
      </div>
    </div>
  )
}
