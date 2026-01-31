import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import {
  Search,
  Lock,
  Globe,
  User,
  Key,
  Loader2,
  Trash2
} from 'lucide-react'
import PaletteInput from './PaletteInput'
import PaletteList, { PaletteListItem } from './PaletteList'
import { createEntryActions, Action } from './PaletteActions'
import { useKeyboardNav } from '../hooks/useKeyboardNav'
import { fetchFavicon } from '../utils/favicon'

type PaletteMode = 'setup' | 'locked' | 'search' | 'actions' | 'add-entry' | 'edit-entry' | 'delete-confirm'

interface Entry {
  id: string
  title: string
  username: string
  icon_url?: string
}

interface CommandPaletteProps {
  initialMode: PaletteMode
}

function CommandPalette({ initialMode }: CommandPaletteProps) {
  const appWindow = getCurrentWindow()
  const [mode, setMode] = useState<PaletteMode>(initialMode)
  const [inputValue, setInputValue] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [searchResults, setSearchResults] = useState<Entry[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [actions, setActions] = useState<Action[]>([])
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    url: ''
  })
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null)
  const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null)
  const [entryToEdit, setEntryToEdit] = useState<Entry | null>(null)
  const paletteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedIndex(0)
  }, [mode, searchResults, actions])

  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    try {
      const result = await invoke('search_entries', { query })
      const entries = JSON.parse(result as string)
      console.log('Search results:', entries)

      if (Array.isArray(entries)) {
        setSearchResults(entries)
      } else if (entries.status === 'error') {
        console.error('Search failed:', entries.message)
        setMode('locked')
      }
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    }
  }

  const handleCopyPassword = async (entryId: string) => {
    try {
      const result = await invoke('request_secret', { entryId, field: 'password' })
      const response = JSON.parse(result as string)

      if (response.status === 'success' && response.value) {
        await navigator.clipboard.writeText(response.value)
        setMode('search')
        setInputValue('')
        setSearchResults([])
      } else if (response.status === 'error') {
        console.error('Failed to copy password:', response.message)
        if (response.message.includes('locked')) {
          setMode('locked')
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

  const handleLock = async () => {
    try {
      await invoke('lock_vault')
      setMode('locked')
      setInputValue('')
      setConfirmPassword('')
      setSearchResults([])
      setError('')
    } catch (error) {
      console.error('Failed to lock vault:', error)
    }
  }

  const handleSetup = async () => {
    setError('')
    if (inputValue !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (inputValue.length === 0) {
      setError('Password cannot be empty')
      return
    }

    try {
      const result = await invoke('init_vault', { password: inputValue })
      const response = JSON.parse(result as string)

      if (response.status === 'success') {
        setMode('search')
        setInputValue('')
        setConfirmPassword('')
        setError('')
      } else {
        setError(response.message || 'Failed to initialize vault')
      }
    } catch (err) {
      setError(err as string)
    }
  }

  const handleUnlock = async () => {
    setError('')
    if (inputValue.length === 0) {
      setError('Password cannot be empty')
      return
    }

    setIsUnlocking(true)
    try {
      const result = await invoke('unlock_vault', { password: inputValue })
      const response = JSON.parse(result as string)

      if (response.status === 'success') {
        setMode('search')
        setInputValue('')
        setError('')
      } else {
        setError(response.message || 'Failed to unlock vault')
      }
    } catch (err) {
      setError(err as string)
    } finally {
      setIsUnlocking(false)
    }
  }

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
      const response = JSON.parse(result as string)

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
    if (mode === 'setup') {
      handleSetup()
    } else if (mode === 'locked') {
      handleUnlock()
    } else if (mode === 'search' && searchResults.length > 0) {
      const selected = searchResults[selectedIndex]
      setActions(createEntryActions(selected.id, selected.title, handleCopyPassword, handleCopyUsername, handleEdit, handleLock, onBack))
      setMode('actions')
      setSelectedIndex(0)
    } else if (mode === 'search' && inputValue.length > 0) {
      setMode('add-entry')
      setFormData({ title: inputValue, username: '', password: '', url: '' })
      setError('')
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
      const response = JSON.parse(result as string)

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
      const entry = JSON.parse(result as string)

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
      setMode('search')
      setError('')
    } else if (mode === 'delete-confirm') {
      setMode('search')
      setEntryToDelete(null)
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
  const showPasswordConfirm = mode === 'setup'
  const isPasswordMode = mode === 'setup' || mode === 'locked'

  const resizeWindow = useCallback(() => {
    const palette = paletteRef.current
    if (!palette) return

    const height = Math.ceil(palette.getBoundingClientRect().height)
    if (height <= 0) return

    const width = 640
    void appWindow.setSize(new LogicalSize(width, height))
    void appWindow.center()
  }, [appWindow])

  useLayoutEffect(() => {
    resizeWindow()
  }, [resizeWindow, mode, itemCount, error, showPasswordConfirm, showList])

  useKeyboardNav({
    itemCount,
    selectedIndex,
    onSelectedIndexChange: setSelectedIndex,
    onEnter: handleEnterKey,
    onEscape: handleEscape,
    enabled: mode === 'search' || mode === 'actions' || mode === 'add-entry' || mode === 'edit-entry' || mode === 'delete-confirm',
  })

  useEffect(() => {
    if (mode === 'search' && inputValue.length >= 2) {
      handleSearch(inputValue)
    } else if (mode === 'search') {
      setSearchResults([])
    }
  }, [inputValue, mode])

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'Backspace' && hoveredEntryId && mode === 'search') {
        e.preventDefault()
        const entry = searchResults.find((ent) => ent.id === hoveredEntryId)
        if (entry) {
          setEntryToDelete(entry)
          setMode('delete-confirm')
          setSelectedIndex(0)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hoveredEntryId, mode, searchResults])

  const getPlaceholder = () => {
    switch (mode) {
      case 'setup':
        return 'Create master password...'
      case 'locked':
        return 'Unlock vault...'
      case 'search':
        return 'Search passwords...'
      case 'actions':
        return 'Actions...'
      case 'add-entry':
        return ''
      case 'edit-entry':
        return ''
      case 'delete-confirm':
        return 'Confirm deletion...'
      default:
        return ''
    }
  }

  const getIcon = () => {
    if (mode === 'locked' && isUnlocking) {
      return Loader2
    }
    switch (mode) {
      case 'setup':
      case 'locked':
        return Lock
      case 'search':
        return Search
      default:
        return Search
    }
  }

  return (
    <div className="command-palette" ref={paletteRef}>
      {mode === 'add-entry' || mode === 'edit-entry' ? (
        <>
          <PaletteInput
            value={formData.title}
            onChange={(val) => setFormData({...formData, title: val})}
            placeholder={mode === 'edit-entry' ? 'Edit website title...' : 'Website title...'}
            icon={Globe}
            autoFocus={true}
          />
          <PaletteInput
            value={formData.username}
            onChange={(val) => setFormData({...formData, username: val})}
            placeholder={mode === 'edit-entry' ? 'Edit username or email...' : 'Username or email...'}
            icon={User}
          />
          <PaletteInput
            value={formData.password}
            onChange={(val) => setFormData({...formData, password: val})}
            placeholder={mode === 'edit-entry' ? 'Edit password...' : 'Password...'}
            type="password"
            icon={Key}
          />
          <PaletteInput
            value={formData.url}
            onChange={(val) => setFormData({...formData, url: val})}
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
      ) : (
        <>
          <PaletteInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={isPasswordMode ? (mode === 'setup' ? handleSetup : handleUnlock) : undefined}
            placeholder={getPlaceholder()}
            type={isPasswordMode ? 'password' : 'text'}
            icon={getIcon()}
            autoFocus={true}
            disabled={mode === 'locked' && isUnlocking}
            iconSpin={mode === 'locked' && isUnlocking}
          />

          {showPasswordConfirm && (
            <div className="palette-confirm-container">
              <PaletteInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                onSubmit={handleSetup}
                placeholder="Confirm master password..."
                type="password"
                icon={Lock}
                autoFocus={false}
              />
            </div>
          )}

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
                  <kbd>↑↓</kbd> Navigate <kbd>Enter</kbd> Select <kbd>Shift+Backspace</kbd> Delete <kbd>Esc</kbd> Clear
                </span>
              ) : (
                <span className="palette-footer-hint">
                  <kbd>Enter</kbd> Add New Password <kbd>Esc</kbd> Hide
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
