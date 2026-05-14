import { useState, useEffect } from 'react'
import { useClipboardGuard } from '../../hooks/useClipboardGuard'
import { useKeyboardNav } from '../../hooks/useKeyboardNav'
import PaletteList from '../PaletteList'
import { createEntryActions } from '../PaletteActions'
import { type PaletteMode, type CredentialPreview } from '../../api/types'
import { api } from '../../api/client'

interface EntryActionsProps {
  entry: CredentialPreview
  onModeChange: (mode: PaletteMode, entry?: CredentialPreview, prefillTitle?: string) => void
  onLock: () => void
}

function EntryActions({ entry, onModeChange, onLock }: EntryActionsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { copy } = useClipboardGuard()

  useEffect(() => {
    setSelectedIndex(0)
  }, [])

  const handleCopyPassword = async () => {
    try {
      const value = await api.copyField(entry.id, 'password')
      await copy(value)
      onModeChange('search')
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      if (errMsg.includes('locked')) {
        onModeChange('oauth-login')
      }
    }
  }

  const handleCopyUsername = async () => {
    if (entry.username) {
      await copy(entry.username)
      onModeChange('search')
    }
  }

  const handleEdit = async () => {
    try {
      const fullEntry = await api.getFullEntry(entry.id)
      onModeChange('edit-entry', {
        id: fullEntry.id,
        title: fullEntry.title,
        username: fullEntry.username,
        icon_url: fullEntry.icon_url,
      } as CredentialPreview, fullEntry.title)
    } catch (error) {
      console.error('Failed to load entry for editing:', error)
    }
  }

  const onBack = () => {
    onModeChange('search')
  }

  const handleDelete = () => {
    onModeChange('delete-confirm', entry)
  }

  const actions = createEntryActions(
    entry.id,
    entry.title,
    handleCopyPassword,
    handleCopyUsername,
    handleEdit,
    onLock,
    onBack,
    handleDelete
  )

  const handleEnterKey = () => {
    actions[selectedIndex].handler()
  }

  const handleEscape = () => {
    onModeChange('search')
  }

  useKeyboardNav({
    itemCount: actions.length,
    selectedIndex,
    onSelectedIndexChange: setSelectedIndex,
    onEnter: handleEnterKey,
    onEscape: handleEscape,
    enabled: true,
  })

  return (
    <>
      <PaletteList
        items={actions}
        selectedIndex={selectedIndex}
        onSelect={(_item, index) => {
          setSelectedIndex(index)
          actions[index].handler()
        }}
      />
      <div className="palette-footer">
        <span className="palette-footer-hint">
          <kbd>↑↓</kbd> Navigate <kbd>Enter</kbd> Execute <kbd>Esc</kbd> Back
        </span>
      </div>
    </>
  )
}

export default EntryActions
