import { useState, useEffect } from 'react'
import { checkStatus } from '@choochmeque/tauri-plugin-biometry-api'
import { Google } from './ui/svgs/google'
import FingerprintIcon from './icons/FingerprintIcon'

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
    <div className="px-5 py-6 flex flex-col items-center gap-4 bg-theme-bg">
      <div className="text-center">
        <h2 className="text-[28px] leading-[1.1] font-extrabold font-theme text-theme-text uppercase tracking-wider mb-1.5">Welcome to Latch</h2>
        <p className="text-sm text-theme-text-secondary font-theme">Choose your authentication method:</p>
      </div>

      <div className="flex flex-col gap-2.5 w-full max-w-[300px]">
        <button
          onClick={onOAuthSelect}
          className="flex flex-col items-center gap-1 px-6 py-3.5 bg-theme-bg text-theme-text border-2 border-theme-accent font-extrabold font-theme uppercase tracking-wider cursor-pointer transition-all duration-100 shadow-theme-sm hover:bg-theme-surface hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          <Google className="w-6 h-6 flex-shrink-0" />
          <span>Sign in with Google</span>
          <span className="text-xs opacity-80 font-normal font-theme normal-case tracking-normal">Use your Google account</span>
        </button>

        <button
          onClick={onBiometricSelect}
          disabled={!biometricAvailable || loading}
          className="flex flex-col items-center gap-1 px-6 py-3.5 bg-theme-accent text-theme-bg border-2 border-theme-accent font-extrabold font-theme uppercase tracking-wider cursor-pointer transition-all duration-100 shadow-theme-sm hover:bg-theme-text hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
          title={
            !biometricAvailable
              ? 'Windows Hello or biometric is not configured on this device'
              : undefined
          }
        >
          <FingerprintIcon size={24} className="text-theme-accent-text" />
          <span>Use {biometricLabel}</span>
          <span className="text-xs opacity-80 font-normal font-theme normal-case tracking-normal">
            {biometricAvailable
              ? 'Use fingerprint or face'
              : 'Not available on this device'}
          </span>
        </button>
      </div>

      <div className="text-center border-t border-theme-border w-full pt-3">
        <p className="text-xs text-theme-text-secondary font-theme">Your vault will be encrypted and stored locally. No backup available.</p>
      </div>
    </div>
  )
}



