import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { z } from 'zod'
import CommandPalette from './components/CommandPalette'
import { useWindowAutoResize } from './hooks/useWindowAutoResize'

const VaultStatusSchema = z.object({
  has_vault: z.boolean(),
  is_unlocked: z.boolean()
})

const AuthMethodResponseSchema = z.object({
  status: z.string(),
  auth_method: z.string()
})

type InitialMode =
  | 'auth-selector'
  | 'oauth-setup'
  | 'oauth-login'
  | 'biometric-setup'
  | 'biometric-login'
  | 'search'

function App() {
  const [hasVault, setHasVault] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [authMethod, setAuthMethod] = useState<string>('none')
  const [loading, setLoading] = useState(true)
  const appRef = useRef<HTMLDivElement>(null)
  useWindowAutoResize(appRef)

  useEffect(() => {
    checkVaultStatus()
  }, [])

  useEffect(() => {
    const unlisten = listen('vault-locked', () => {
      checkVaultStatus()
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  const checkVaultStatus = async () => {
    setLoading(true)
    try {
      const result = await invoke('vault_status')
      const status = VaultStatusSchema.parse(JSON.parse(result as string))
      setHasVault(status.has_vault)
      setIsUnlocked(status.is_unlocked)

      if (status.has_vault && !status.is_unlocked) {
        const authResult = await invoke('get_vault_auth_method')
        const auth = AuthMethodResponseSchema.parse(JSON.parse(authResult as string))
        setAuthMethod(auth.auth_method)
      }
    } catch (error) {
      console.error('Failed to check vault status:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="app-container" ref={appRef}>
        <div className="command-palette">
          <div className="palette-loading">Loading...</div>
        </div>
      </div>
    )
  }

  const initialMode: InitialMode = !hasVault
    ? 'auth-selector'
    : !isUnlocked
      ? authMethod === 'biometric-keychain'
        ? 'biometric-login'
        : 'oauth-login'
      : 'search'

  return (
    <div className="app-container" ref={appRef}>
      <CommandPalette initialMode={initialMode} />
    </div>
  )
}

export default App
