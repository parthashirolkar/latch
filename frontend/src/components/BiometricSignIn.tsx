import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  generateAndStoreKey,
  retrieveKey
} from '../utils/biometricKeys'
import { api } from '../api/client'
import FingerprintIcon from './icons/FingerprintIcon'

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
      await api.provisionWithKey(keyHex, 'biometric-keychain')
      onSuccess()
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
      await api.accessKey(keyHex)
      onSuccess()
    } catch (err) {
      onError?.(String(err))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClick = mode === 'setup' ? handleSetup : handleLogin

  return (
    <div className="px-5 py-6 flex flex-col items-center gap-4 bg-theme-bg">
      <div className="text-center">
        {mode === 'setup' ? (
          <>
            <h2 className="text-[28px] leading-[1.1] font-extrabold font-theme text-theme-text uppercase tracking-wider mb-1.5">Set up Biometric Authentication</h2>
            <p className="text-sm text-theme-text-secondary font-theme">Use your fingerprint or face to protect your vault</p>
          </>
        ) : (
          <>
            <h2 className="text-[28px] leading-[1.1] font-extrabold font-theme text-theme-text uppercase tracking-wider mb-1.5">Unlock Latch</h2>
          </>
        )}
      </div>

      <button
        onClick={handleClick}
        disabled={isProcessing}
        className="flex items-center justify-center gap-2.5 px-6 py-3 bg-theme-accent text-theme-bg border-2 border-theme-accent font-extrabold font-theme uppercase tracking-wider cursor-pointer transition-all duration-100 w-full max-w-[300px] shadow-theme-sm hover:bg-theme-text hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            <span>Authenticating...</span>
          </>
        ) : (
          <>
            <FingerprintIcon size={24} className="text-theme-accent-text" />
            <span>
              {mode === 'setup' ? 'Set up and Create Vault' : 'Unlock with Biometric'}
            </span>
          </>
        )}
      </button>

      <div className="text-center border-t border-theme-border w-full pt-3">
        <p className="text-xs text-theme-text-secondary font-theme">Your vault is protected by biometric authentication</p>
      </div>
    </div>
  )
}



