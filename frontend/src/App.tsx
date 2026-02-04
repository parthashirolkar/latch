import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import CommandPalette from './components/CommandPalette'

interface VaultStatus {
  has_vault: boolean
  is_unlocked: boolean
}

function App() {
  const [hasVault, setHasVault] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [requiresMigration, setRequiresMigration] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkVaultStatus()
  }, [])

  const checkVaultStatus = async () => {
    setLoading(true)
    try {
      const result = await invoke('vault_status')
      const status = JSON.parse(result as string) as VaultStatus
      setHasVault(status.has_vault)
      setIsUnlocked(status.is_unlocked)
      
      if (status.has_vault) {
        const migrationResult = await invoke('vault_requires_migration')
        const migrationStatus = JSON.parse(migrationResult as string)
        setRequiresMigration(migrationStatus.requires_migration)
      }
    } catch (error) {
      console.error('Failed to check vault status:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="command-palette">
          <div className="palette-loading">Loading...</div>
        </div>
      </div>
    )
  }

  const initialMode = !hasVault 
    ? 'oauth-setup' 
    : !isUnlocked 
      ? (requiresMigration ? 'migrate' : 'oauth-login')
      : 'search'

  return (
    <div className="app-container">
      <CommandPalette initialMode={initialMode} />
    </div>
  )
}

export default App
