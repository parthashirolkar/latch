import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import PaletteInput from './PaletteInput'
import PaletteList, { PaletteListItem } from './PaletteList'
import { createEntryActions, Action } from './PaletteActions'
import { useKeyboardNav } from '../hooks/useKeyboardNav'

type PaletteMode = 'setup' | 'locked' | 'search' | 'actions'

interface Entry {
  id: string
  title: string
  username: string
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
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [actions, setActions] = useState<Action[]>([])
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
    }
  }

  const handleEnterKey = () => {
    if (mode === 'setup') {
      handleSetup()
    } else if (mode === 'locked') {
      handleUnlock()
    } else if (mode === 'search' && searchResults.length > 0) {
      const selected = searchResults[selectedIndex]
      if (selected) {
        setSelectedEntry(selected)
        const entryActions = createEntryActions(
          selected.id,
          selected.title,
          handleCopyPassword,
          handleCopyUsername,
          handleLock,
          () => {
            setMode('search')
            setSelectedEntry(null)
          }
        )
        setActions(entryActions)
        setMode('actions')
      }
    } else if (mode === 'actions' && actions.length > 0) {
      const action = actions[selectedIndex]
      if (action) {
        action.handler()
      }
    }
  }

  const handleEscape = () => {
    if (mode === 'actions') {
      setMode('search')
      setSelectedEntry(null)
    } else if (mode === 'search') {
      setInputValue('')
      setSearchResults([])
    }
  }

  const currentItems: PaletteListItem[] =
    mode === 'search'
      ? searchResults.map((entry) => ({
          id: entry.id,
          title: entry.title,
          subtitle: entry.username,
          icon: '🔐',
        }))
      : mode === 'actions'
        ? actions.map((action) => ({
            id: action.id,
            title: action.title,
            subtitle: action.subtitle,
            icon: action.icon,
          }))
        : []

  const itemCount = currentItems.length
  const showList =
    (mode === 'search' && searchResults.length > 0) ||
    (mode === 'actions' && actions.length > 0)
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
    enabled: itemCount > 0 && (mode === 'search' || mode === 'actions'),
  })

  useEffect(() => {
    if (mode === 'search' && inputValue.length >= 2) {
      handleSearch(inputValue)
    } else if (mode === 'search') {
      setSearchResults([])
    }
  }, [inputValue, mode])

  const getPlaceholder = () => {
    switch (mode) {
      case 'setup':
        return 'Create master password...'
      case 'locked':
        return 'Enter master password...'
      case 'search':
        return 'Search passwords...'
      case 'actions':
        return selectedEntry?.title || ''
      default:
        return ''
    }
  }

  const getIcon = () => {
    switch (mode) {
      case 'setup':
      case 'locked':
        return '🔒'
      case 'search':
        return '🔍'
      case 'actions':
        return '⚡'
      default:
        return '🔍'
    }
  }

  const getHint = () => {
    if (mode === 'search' || mode === 'actions') {
      return '⏎'
    }
    return undefined
  }

  return (
    <div className="command-palette" ref={paletteRef}>
      <PaletteInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={isPasswordMode ? (mode === 'setup' ? handleSetup : handleUnlock) : undefined}
        placeholder={getPlaceholder()}
        type={isPasswordMode ? 'password' : 'text'}
        icon={getIcon()}
        hint={getHint()}
        autoFocus={true}
      />

      {showPasswordConfirm && (
        <div className="palette-confirm-container">
          <PaletteInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            onSubmit={handleSetup}
            placeholder="Confirm master password..."
            type="password"
            icon="🔒"
            autoFocus={false}
          />
        </div>
      )}

      {error && <div className="palette-error">{error}</div>}

      {showList && (
        <PaletteList
          items={currentItems}
          selectedIndex={selectedIndex}
          onSelect={(_item, index) => {
            setSelectedIndex(index)
            handleEnterKey()
          }}
        />
      )}

      {(mode === 'search' && searchResults.length > 0) || mode === 'actions' ? (
        <div className="palette-footer">
          {mode === 'search' && searchResults.length > 0 && (
            <span className="palette-footer-hint">
              <kbd>↑↓</kbd> Navigate <kbd>⏎</kbd> Select <kbd>Esc</kbd> Clear
            </span>
          )}
          {mode === 'actions' && (
            <span className="palette-footer-hint">
              <kbd>↑↓</kbd> Navigate <kbd>⏎</kbd> Execute <kbd>Esc</kbd> Back
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default CommandPalette
