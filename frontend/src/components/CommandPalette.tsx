import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { z } from 'zod'
import {
  Search,
  Lock,
  Globe,
  User,
  Key,
  Loader2,
  Trash2,
  Shield,
  Dice1,
  Activity
} from 'lucide-react'
import PaletteInput from './PaletteInput'
import PaletteList, { PaletteListItem } from './PaletteList'
import { createEntryActions, createUtilityActions, Action } from './PaletteActions'
import { useKeyboardNav } from '../hooks/useKeyboardNav'
import { useDebounce } from '../hooks/useDebounce'
import { useSearch, Entry } from '../hooks/useSearch'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { fetchFavicon } from '../utils/favicon'
import OAuthSignIn from './OAuthSignIn'
import BiometricSignIn from './BiometricSignIn'
import AuthSelector from './AuthSelector'
import MigrateVault from './MigrateVault'
import Settings from './Settings'
import PasswordGenerator from './PasswordGenerator'
import VaultHealth from './VaultHealth'
import WeakPasswordsList from './health/WeakPasswordsList'
import ReusedPasswordsList from './health/ReusedPasswordsList'
import BreachedCredentialsList from './health/BreachedCredentialsList'

const EntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  username: z.string(),
  password: z.string(),
  url: z.string().optional(),
  icon_url: z.string().optional()
})



const ErrorResponseSchema = z.object({
  status: z.literal('error'),
  message: z.string()
})

const SuccessResponseSchema = z.object({
  status: z.literal('success'),
  message: z.string().optional()
})

const SecretResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    value: z.string()
  }),
  z.object({
    status: z.literal('error'),
    message: z.string()
  })
])

const ResponseSchema = z.discriminatedUnion('status', [
  SuccessResponseSchema,
  ErrorResponseSchema
])

const AuthMethodResponseSchema = z.object({
  status: z.string(),
  auth_method: z.string()
})

export type PaletteMode = 'search' | 'actions' | 'add-entry' | 'edit-entry' | 'delete-confirm' | 'auth-selector' | 'oauth-setup' | 'oauth-login' | 'biometric-setup' | 'biometric-login' | 'migrate' | 'settings' | 'password-generator' | 'vault-health' | 'health-weak' | 'health-reused' | 'health-breached'



interface CommandPaletteProps {
  initialMode: PaletteMode
}

function CommandPalette({ initialMode }: CommandPaletteProps) {
  const [mode, setMode] = useState<PaletteMode>(initialMode)

  const setModeToLogin = useCallback(async () => {
    try {
      const authResult = await invoke('get_vault_auth_method')
      const auth = AuthMethodResponseSchema.parse(JSON.parse(authResult as string))
      setMode(
        auth.auth_method === 'biometric-keychain'
          ? 'biometric-login'
          : 'oauth-login'
      )
    } catch {
      setMode('oauth-login')
    }
  }, [])

  const { searchResults, setSearchResults, isLoading, handleSearch } = useSearch(setModeToLogin)

  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [actions, setActions] = useState<Action[]>([])
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    url: ''
  })
  const [isUnlocking] = useState(false)
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null)
  const [entryToEdit, setEntryToEdit] = useState<Entry | null>(null)
  const [entryForGenerator, setEntryForGenerator] = useState<Entry | null>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const clearClipboardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedInputValue = useDebounce(inputValue, 300)

  useEffect(() => {
    setSelectedIndex(0)
  }, [mode, searchResults, actions])

  useEffect(() => {
    return () => {
      if (clearClipboardTimeoutRef.current !== null) {
        window.clearTimeout(clearClipboardTimeoutRef.current)
      }
    }
  }, [])



  const handleCopyPassword = async (entryId: string) => {
    try {
      const result = await invoke('request_secret', { entryId, field: 'password' })
      const response = SecretResponseSchema.parse(JSON.parse(result as string))

      if (response.status === 'success') {
        await navigator.clipboard.writeText(response.value)
        setMode('search')
        setInputValue('')
        setSearchResults([])

        if (clearClipboardTimeoutRef.current !== null) {
          window.clearTimeout(clearClipboardTimeoutRef.current)
        }
        clearClipboardTimeoutRef.current = window.setTimeout(async () => {
          try {
            const currentText = await navigator.clipboard.readText()
            if (currentText === response.value) {
              await navigator.clipboard.writeText('')
            }
          } catch {
            // Ignore clipboard read errors - may be denied by browser/OS
          }
        }, 30000)
      } else {
        console.error('Failed to copy password:', response.message)
        if (response.message.includes('locked')) {
          setModeToLogin()
        }
      }
    } catch (error) {
      console.error('Failed to copy password:', error)
    }
  }

  const handleCopyUsername = async (entryId: string) => {
    const entry = searchResults.find((e) => e.id === entryId)
    if (entry?.username) {
      await navigator.clipboard.writeText(entry.username)
      setMode('search')
      setInputValue('')
      setSearchResults([])
    }
  }



  const handleLock = useCallback(async () => {
    try {
      await invoke('lock_vault')
      await setModeToLogin()
      setInputValue('')
      setSearchResults([])
      setError('')
    } catch (error) {
      console.error('Failed to lock vault:', error)
    }
  }, [setModeToLogin, setSearchResults])

  const handleAddEntry = async () => {
    setError('')

    if (!formData.title || !formData.username || !formData.password) {
      setError('Title, username, and password are required')
      return
    }

    try {
      let iconUrl: string | undefined
      const url = formData.url.trim() || undefined

      if (url) {
        try {
          const favicon = await fetchFavicon(url)
          if (favicon) {
            iconUrl = favicon
          }
        } catch (favError) {
          console.error('Error fetching favicon:', favError)
        }
      }

      const isEditing = entryToEdit !== null
      const payload = {
        id: entryToEdit?.id,
        title: formData.title,
        username: formData.username,
        password: formData.password,
        url: url,
        iconUrl: iconUrl
      }

      const command = isEditing ? 'update_entry' : 'add_entry'
      const result = await invoke(command, payload)
      const response = ResponseSchema.parse(JSON.parse(result as string))

      if (response.status === 'success') {
        setFormData({ title: '', username: '', password: '', url: '' })
        setEntryToEdit(null)
        setMode('search')
        setError('')
      }
    } catch (err) {
      console.error(`Error ${entryToEdit ? 'updating' : 'adding'} entry:`, err)
      setError(err as string)
    }
  }

  const handleEnterKey = () => {
    if (mode === 'search' && searchResults.length > 0) {
      const selected = searchResults[selectedIndex]
      setActions(createEntryActions(selected.id, selected.title, handleCopyPassword, handleCopyUsername, handleEdit, handleLock, onBack))
      setMode('actions')
      setSelectedIndex(0)
    } else if (mode === 'search' && inputValue.length > 0) {
      setMode('add-entry')
      setFormData({ title: inputValue, username: '', password: '', url: '' })
      setError('')
    } else if (mode === 'search' && inputValue.length === 0) {
      setActions(createUtilityActions(
        () => {
          setEntryForGenerator(null)
          setMode('password-generator')
        },
        () => setMode('vault-health')
      ))
      setMode('actions')
      setSelectedIndex(0)
    } else if (mode === 'actions') {
      actions[selectedIndex].handler()
    } else if (mode === 'add-entry' || mode === 'edit-entry') {
      handleAddEntry()
    } else if (mode === 'delete-confirm') {
      if (selectedIndex === 0 && entryToDelete) {
        handleDeleteEntry(entryToDelete.id)
      } else {
        setMode('search')
        setEntryToDelete(null)
      }
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const result = await invoke('delete_entry', { entryId })
      const response = ResponseSchema.parse(JSON.parse(result as string))

      if (response.status === 'success') {
        setMode('search')
        setEntryToDelete(null)
        setInputValue('')
        setSearchResults([])
      }
    } catch (error) {
      setError(error as string)
    }
  }

  const handleEdit = async (entryId: string) => {
    try {
      const result = await invoke('get_full_entry', { entryId })
      const entry = EntrySchema.parse(JSON.parse(result as string))

      setFormData({
        title: entry.title,
        username: entry.username,
        password: entry.password,
        url: entry.url || ''
      })
      setEntryToEdit({
        id: entry.id,
        title: entry.title,
        username: entry.username,
        icon_url: entry.icon_url
      })
      setMode('edit-entry')
      setSelectedIndex(0)
      setError('')
    } catch (error) {
      console.error('Failed to load entry for editing:', error)
      setError(error as string)
    }
  }

  const onBack = () => {
    setMode('search')
  }

  const handleEscape = async () => {
    if (mode === 'actions') {
      setMode('search')
    } else if (mode === 'add-entry' || mode === 'edit-entry') {
      setFormData({ title: '', username: '', password: '', url: '' })
      setEntryToEdit(null)
      setEntryForGenerator(null)
      setMode('search')
      setError('')
    } else if (mode === 'delete-confirm') {
      setMode('search')
      setEntryToDelete(null)
    } else if (mode === 'settings') {
      setMode('search')
    } else if (mode === 'password-generator') {
      setEntryForGenerator(null)
      setMode('search')
    } else if (mode === 'vault-health') {
      setMode('search')
    } else if (mode === 'health-weak' || mode === 'health-reused' || mode === 'health-breached') {
      setMode('vault-health')
    } else if (mode === 'oauth-setup' || mode === 'biometric-setup') {
      setMode('auth-selector')
      setError('')
    } else if (mode === 'search' && inputValue.length > 0) {
      setInputValue('')
    } else if (mode === 'search') {
      onBack()
    }
  }

  const currentItems: PaletteListItem[] =
    mode === 'search'
      ? searchResults.map((entry) => ({
        id: entry.id,
        title: entry.title,
        subtitle: entry.username,
        icon: Lock,
        iconUrl: entry.icon_url,
      }))
      : mode === 'actions'
        ? actions
        : mode === 'delete-confirm'
          ? [
            {
              id: 'confirm-delete',
              title: 'Yes, delete this password',
              subtitle: 'This cannot be undone',
              icon: Trash2,
            },
            {
              id: 'cancel-delete',
              title: 'Cancel',
              subtitle: 'Go back to search',
              icon: Search,
            },
          ]
          : []

  const itemCount = currentItems.length
  const showList =
    (mode === 'search' && searchResults.length > 0) ||
    (mode === 'actions' && actions.length > 0) ||
    mode === 'delete-confirm'

  useKeyboardNav({
    itemCount,
    selectedIndex,
    onSelectedIndexChange: setSelectedIndex,
    onEnter: handleEnterKey,
    onEscape: handleEscape,
    enabled: mode === 'search' || mode === 'actions' || mode === 'add-entry' || mode === 'edit-entry' || mode === 'delete-confirm' || mode === 'settings' || mode === 'vault-health' || mode === 'health-weak' || mode === 'health-reused' || mode === 'health-breached' || mode === 'password-generator',
  })

  useEffect(() => {
    if (mode === 'search' && debouncedInputValue.length >= 2) {
      handleSearch(debouncedInputValue)
    } else if (mode === 'search') {
      setSearchResults([])
    }
  }, [debouncedInputValue, mode, handleSearch, setSearchResults])

  useEffect(() => {
    if (mode === 'search' && searchResults.length > 0 && selectedIndex >= 0) {
      const selectedEntry = searchResults[selectedIndex]
      if (selectedEntry) {
        setHoveredEntryId(selectedEntry.id)
      }
    } else {
      setHoveredEntryId(null)
    }
  }, [selectedIndex, searchResults, mode])

  useKeyboardShortcuts({
    mode,
    hoveredEntryId,
    searchResults,
    setEntryToDelete,
    setMode,
    setSelectedIndex,
    handleLock,
    setEntryForGenerator,
    setInputValue,
    setSearchResults
  })

  const getPlaceholder = () => {
    switch (mode) {
      case 'search':
        return inputValue ? 'Search passwords...' : 'Type to search...'
      case 'actions':
        return 'Select an action...'
      case 'add-entry':
        return ''
      case 'edit-entry':
        return ''
      case 'delete-confirm':
        return 'Confirm deletion...'
      case 'password-generator':
      case 'vault-health':
      case 'health-weak':
      case 'health-reused':
      case 'health-breached':
        return ''
      default:
        return ''
    }
  }

  const getIcon = () => {
    if (mode === 'oauth-setup' && isUnlocking) {
      return Loader2
    }
    switch (mode) {
      case 'oauth-setup':
      case 'biometric-setup':
        return Lock
      case 'search':
        return Search
      case 'vault-health':
        return Shield
      case 'password-generator':
        return Dice1
      case 'health-weak':
      case 'health-reused':
      case 'health-breached':
        return Activity
      default:
        return Search
    }
  }

  const handleOAuthSuccess = () => {
    setMode('search')
    setInputValue('')
    setError('')
  }

  const handleOAuthError = (errorMsg: string) => {
    setError(errorMsg)
  }

  return (
    <div className="command-palette" ref={paletteRef}>
      {mode === 'add-entry' || mode === 'edit-entry' ? (
        <>
          <PaletteInput
            value={formData.title}
            onChange={(val) => setFormData({ ...formData, title: val })}
            placeholder={mode === 'edit-entry' ? 'Edit website title...' : 'Website title...'}
            icon={Globe}
            autoFocus={true}
          />
          <PaletteInput
            value={formData.username}
            onChange={(val) => setFormData({ ...formData, username: val })}
            placeholder={mode === 'edit-entry' ? 'Edit username or email...' : 'Username or email...'}
            icon={User}
          />
          <PaletteInput
            value={formData.password}
            onChange={(val) => setFormData({ ...formData, password: val })}
            placeholder={mode === 'edit-entry' ? 'Edit password...' : 'Password...'}
            type="password"
            icon={Key}
          />
          <PaletteInput
            value={formData.url}
            onChange={(val) => setFormData({ ...formData, url: val })}
            placeholder={mode === 'edit-entry' ? 'Edit website URL...' : 'Website URL (optional)...'}
            icon={Globe}
          />
          {error && <div className="palette-error">{error}</div>}
          <div className="palette-footer">
            <span className="palette-footer-hint">
              <kbd>Enter</kbd> {mode === 'edit-entry' ? 'Update' : 'Save'} <kbd>Esc</kbd> Cancel
            </span>
          </div>
        </>
      ) : mode === 'auth-selector' ? (
        <AuthSelector
          onOAuthSelect={() => setMode('oauth-setup')}
          onBiometricSelect={() => setMode('biometric-setup')}
        />
      ) : mode === 'oauth-setup' ? (
        <OAuthSignIn mode="setup" onSuccess={handleOAuthSuccess} onError={handleOAuthError} />
      ) : mode === 'oauth-login' ? (
        <OAuthSignIn mode="login" onSuccess={handleOAuthSuccess} onError={handleOAuthError} />
      ) : mode === 'biometric-setup' ? (
        <BiometricSignIn
          mode="setup"
          onSuccess={handleOAuthSuccess}
          onError={handleOAuthError}
        />
      ) : mode === 'biometric-login' ? (
        <BiometricSignIn
          mode="login"
          onSuccess={handleOAuthSuccess}
          onError={handleOAuthError}
        />
      ) : mode === 'migrate' ? (
        <MigrateVault onSuccess={handleOAuthSuccess} onError={handleOAuthError} />
      ) : mode === 'settings' ? (
        <Settings />
      ) : mode === 'password-generator' ? (
        <PasswordGenerator
          onPasswordSelect={(password) => {
            if (entryForGenerator) {
              setEntryToEdit(entryForGenerator)
              setFormData({ ...formData, password })
              setMode('edit-entry')
            } else {
              setFormData({ ...formData, password })
            }
          }}
          onCancel={() => {
            if (entryForGenerator) {
              setEntryForGenerator(null)
              setMode('edit-entry')
            } else {
              setMode('add-entry')
            }
          }}
          initialLength={16}
        />
      ) : mode === 'vault-health' ? (
        <VaultHealth
          onWeakPasswords={() => setMode('health-weak')}
          onReusedPasswords={() => setMode('health-reused')}
          onBreachedCredentials={() => setMode('health-breached')}
        />
      ) : mode === 'health-weak' ? (
        <WeakPasswordsList
          onSelectEntry={(entryId) => {
            const entry = searchResults.find(e => e.id === entryId)
            if (entry) {
              setEntryToEdit(entry)
              setFormData({
                title: entry.title,
                username: entry.username,
                password: '',
                url: entry.icon_url || ''
              })
              setMode('edit-entry')
            }
          }}
        />
      ) : mode === 'health-reused' ? (
        <ReusedPasswordsList
          onSelectEntry={(entryId) => {
            const entry = searchResults.find(e => e.id === entryId)
            if (entry) {
              setEntryToEdit(entry)
              setFormData({
                title: entry.title,
                username: entry.username,
                password: '',
                url: entry.icon_url || ''
              })
              setMode('edit-entry')
            }
          }}
        />
      ) : mode === 'health-breached' ? (
        <BreachedCredentialsList
          onSelectEntry={(entryId) => {
            const entry = searchResults.find(e => e.id === entryId)
            if (entry) {
              setEntryToEdit(entry)
              setFormData({
                title: entry.title,
                username: entry.username,
                password: '',
                url: entry.icon_url || ''
              })
              setMode('edit-entry')
            }
          }}
        />
      ) : (
        <>
          <PaletteInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={undefined}
            placeholder={getPlaceholder()}
            type="text"
            icon={getIcon()}
            autoFocus={true}
            disabled={false}
            iconSpin={isLoading}
          />

          {error && <div className="palette-error">{error}</div>}

          {showList && (
            <PaletteList
              items={currentItems}
              selectedIndex={selectedIndex}
              onItemHover={mode === 'search' ? setHoveredEntryId : undefined}
              onSelect={(_item, index) => {
                setSelectedIndex(index)
                handleEnterKey()
              }}
            />
          )}

          {mode === 'search' ? (
            <div className="palette-footer">
              {searchResults.length > 0 ? (
                <span className="palette-footer-hint">
                  <kbd>↑↓</kbd> Navigate <kbd>Enter</kbd> Select <kbd>Shift+Backspace</kbd> Delete <kbd>Esc</kbd> Clear <kbd>,</kbd> Settings <kbd>Ctrl+H</kbd> Health
                </span>
              ) : (
                <span className="palette-footer-hint">
                  <kbd>Enter</kbd> Add New Password <kbd>Esc</kbd> Hide <kbd>Ctrl+G</kbd> Generate <kbd>Ctrl+H</kbd> Health <kbd>,</kbd> Settings
                </span>
              )}
            </div>
          ) : mode === 'actions' ? (
            <div className="palette-footer">
              <span className="palette-footer-hint">
                <kbd>↑↓</kbd> Navigate <kbd>Enter</kbd> Execute <kbd>Esc</kbd> Back
              </span>
            </div>
          ) : mode === 'delete-confirm' ? (
            <div className="palette-footer">
              <span className="palette-footer-hint">
                <kbd>↑↓</kbd> Navigate <kbd>Enter</kbd> Confirm <kbd>Esc</kbd> Cancel
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default CommandPalette
