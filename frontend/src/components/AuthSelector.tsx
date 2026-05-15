import { useState, useEffect } from 'react'
import { Globe, Fingerprint } from 'lucide-react'
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
    <div className="px-5 py-6 flex flex-col items-center gap-4 bg-brutal-black">
      <div className="text-center">
        <h2 className="text-[28px] leading-[1.1] font-extrabold font-mono text-brutal-white uppercase tracking-wider mb-1.5">Welcome to Latch</h2>
        <p className="text-sm text-white/80 font-mono">Choose your authentication method:</p>
      </div>

      <div className="flex flex-col gap-2.5 w-full max-w-[300px]">
        <button
          onClick={onOAuthSelect}
          className="flex flex-col items-center gap-1 px-6 py-3.5 bg-brutal-black text-brutal-white border-2 border-brutal-yellow font-extrabold font-mono uppercase tracking-wider cursor-pointer transition-all duration-100 shadow-[4px_4px_0px_var(--color-brutal-yellow)] hover:bg-[#222] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brutal-yellow)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          <Globe size={24} />
          <span>Sign in with Google</span>
          <span className="text-xs opacity-80 font-normal font-mono normal-case tracking-normal">Use your Google account</span>
        </button>

        <button
          onClick={onBiometricSelect}
          disabled={!biometricAvailable || loading}
          className="flex flex-col items-center gap-1 px-6 py-3.5 bg-brutal-yellow text-brutal-black border-2 border-brutal-yellow font-extrabold font-mono uppercase tracking-wider cursor-pointer transition-all duration-100 shadow-[4px_4px_0px_var(--color-brutal-yellow)] hover:bg-brutal-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brutal-yellow)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
          title={
            !biometricAvailable
              ? 'Windows Hello or biometric is not configured on this device'
              : undefined
          }
        >
          <Fingerprint size={24} />
          <span>Use {biometricLabel}</span>
          <span className="text-xs opacity-80 font-normal font-mono normal-case tracking-normal">
            {biometricAvailable
              ? 'Use fingerprint or face'
              : 'Not available on this device'}
          </span>
        </button>
      </div>

      <div className="text-center border-t border-[#555] w-full pt-3">
        <p className="text-xs text-brutal-gray font-mono">Your vault will be encrypted and stored locally. No backup available.</p>
      </div>
    </div>
  )
}
