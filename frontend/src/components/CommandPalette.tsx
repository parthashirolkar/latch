import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { type PaletteMode, type CredentialPreview } from '../api/types'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import SearchMode from './modes/SearchMode'
import EntryActions from './modes/EntryActions'
import AddCredential from './modes/AddCredential'
import DeleteConfirm from './modes/DeleteConfirm'
import AuthSelector from './AuthSelector'
import OAuthSignIn from './OAuthSignIn'
import BiometricSignIn from './BiometricSignIn'
import MigrateVault from './MigrateVault'
import Settings from './Settings'
import PasswordGenerator from './PasswordGenerator'
import VaultHealth from './VaultHealth'
import WeakPasswordsList from './health/WeakPasswordsList'
import ReusedPasswordsList from './health/ReusedPasswordsList'
import BreachedCredentialsList from './health/BreachedCredentialsList'

export type { PaletteMode } from '../api/types'

interface CommandPaletteProps {
  initialMode: PaletteMode
}

function CommandPalette({ initialMode }: CommandPaletteProps) {
  const [mode, setMode] = useState<PaletteMode>(initialMode)
  const [activeEntry, setActiveEntry] = useState<CredentialPreview | null>(null)
  const [prefillTitle, setPrefillTitle] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [entryForGenerator, setEntryForGenerator] = useState<CredentialPreview | null>(null)
  const [credentialsChanged, setCredentialsChanged] = useState(0)

  useEffect(() => {
    setMode(initialMode)
    setActiveEntry(null)
    setPrefillTitle('')
    setGeneratedPassword('')
    setEntryForGenerator(null)
  }, [initialMode])

  const handleCredentialsChanged = useCallback(() => {
    setCredentialsChanged((c) => c + 1)
  }, [])

  const handleLock = useCallback(async () => {
    try {
      await api.lockVault()
      const authMethod = await api.getAuthMethod()
      setMode(authMethod === 'biometric-keychain' ? 'biometric-login' : 'oauth-login')
    } catch (error) {
      console.error('Failed to lock vault:', error)
    }
  }, [])

  const handleModeChange = useCallback((newMode: PaletteMode, entry?: CredentialPreview, title?: string) => {
    if (newMode === 'search') {
      setActiveEntry(null)
      setPrefillTitle('')
    } else {
      if (entry) {
        setActiveEntry(entry)
      }
      if (title !== undefined) {
        setPrefillTitle(title)
      }
    }
    if (newMode !== 'add-entry' && newMode !== 'edit-entry') {
      setGeneratedPassword('')
    }
    if (newMode === 'search' || newMode === 'add-entry' || newMode === 'edit-entry') {
      setEntryForGenerator(null)
    }
    setMode(newMode)
  }, [])

  const handleOAuthSuccess = useCallback(() => {
    setMode('search')
    setActiveEntry(null)
  }, [])

  const handleOAuthError = useCallback((_errorMsg: string) => {
  }, [])

  const handleShortcutEscape = useCallback(() => {
    if (mode === 'settings') {
      setMode('search')
    } else if (mode === 'vault-health') {
      setMode('search')
    } else if (mode === 'health-weak' || mode === 'health-reused' || mode === 'health-breached') {
      setMode('vault-health')
    }
  }, [mode])

  useKeyboardShortcuts({
    onEscape: handleShortcutEscape,
    enabled: mode === 'settings' || mode === 'vault-health' ||
             mode === 'health-weak' || mode === 'health-reused' || mode === 'health-breached',
  })

  const renderMode = () => {
    switch (mode) {
      case 'search':
        return (
          <SearchMode
            onModeChange={handleModeChange}
            onLock={handleLock}
            searchTrigger={credentialsChanged}
          />
        )

      case 'actions':
        return activeEntry ? (
          <EntryActions
            entry={activeEntry}
            onModeChange={handleModeChange}
            onLock={handleLock}
          />
        ) : null

      case 'add-entry':
        return (
          <AddCredential
            editEntry={null}
            prefillTitle={prefillTitle}
            generatedPassword={generatedPassword}
            onModeChange={handleModeChange}
            onCredentialsChanged={handleCredentialsChanged}
          />
        )

      case 'edit-entry':
        return (
          <AddCredential
            editEntry={activeEntry}
            prefillTitle={prefillTitle}
            generatedPassword={generatedPassword}
            onModeChange={handleModeChange}
            onCredentialsChanged={handleCredentialsChanged}
          />
        )

      case 'delete-confirm':
        return activeEntry ? (
          <DeleteConfirm
            entry={activeEntry}
            onModeChange={handleModeChange}
            onCredentialsChanged={handleCredentialsChanged}
          />
        ) : null

      case 'auth-selector':
        return (
          <AuthSelector
            onOAuthSelect={() => setMode('oauth-setup')}
            onBiometricSelect={() => setMode('biometric-setup')}
          />
        )

      case 'oauth-setup':
        return (
          <OAuthSignIn mode="setup" onSuccess={handleOAuthSuccess} onError={handleOAuthError} />
        )

      case 'oauth-login':
        return (
          <OAuthSignIn mode="login" onSuccess={handleOAuthSuccess} onError={handleOAuthError} />
        )

      case 'biometric-setup':
        return (
          <BiometricSignIn mode="setup" onSuccess={handleOAuthSuccess} onError={handleOAuthError} />
        )

      case 'biometric-login':
        return (
          <BiometricSignIn mode="login" onSuccess={handleOAuthSuccess} onError={handleOAuthError} />
        )

      case 'migrate':
        return <MigrateVault onSuccess={handleOAuthSuccess} onError={handleOAuthError} />

      case 'settings':
        return <Settings />

      case 'password-generator':
        return (
          <PasswordGenerator
            onPasswordSelect={(password) => {
              if (entryForGenerator) {
                setGeneratedPassword(password)
                setActiveEntry(entryForGenerator)
                setMode('edit-entry')
              } else {
                setGeneratedPassword(password)
                setMode('add-entry')
              }
            }}
            onCancel={() => {
              if (entryForGenerator) {
                setActiveEntry(entryForGenerator)
                setMode('edit-entry')
              } else {
                setMode('search')
              }
              setEntryForGenerator(null)
              setGeneratedPassword('')
            }}
            initialLength={16}
          />
        )

      case 'vault-health':
        return (
          <VaultHealth
            onWeakPasswords={() => setMode('health-weak')}
            onReusedPasswords={() => setMode('health-reused')}
            onBreachedCredentials={() => setMode('health-breached')}
          />
        )

      case 'health-weak':
        return (
          <WeakPasswordsList
            onSelectEntry={(entryId) => {
              const entry: CredentialPreview = { id: entryId, title: '', username: '' }
              setActiveEntry(entry)
              setMode('edit-entry')
            }}
          />
        )

      case 'health-reused':
        return (
          <ReusedPasswordsList
            onSelectEntry={(entryId) => {
              const entry: CredentialPreview = { id: entryId, title: '', username: '' }
              setActiveEntry(entry)
              setMode('edit-entry')
            }}
          />
        )

      case 'health-breached':
        return (
          <BreachedCredentialsList
            onSelectEntry={(entryId) => {
              const entry: CredentialPreview = { id: entryId, title: '', username: '' }
              setActiveEntry(entry)
              setMode('edit-entry')
            }}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="w-full h-auto max-h-none bg-theme-bg border-none shadow-none flex flex-col overflow-visible">
      {renderMode()}
    </div>
  )
}

export default CommandPalette



