import { useState } from 'react'
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
  const [error, setError] = useState('')
  const { copy } = useClipboardGuard()

  const handleCopyPassword = async () => {
    try {
      const value = await api.copyField(entry.id, 'password')
      await copy(value)
      onModeChange('search')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('locked')) {
        onModeChange('oauth-login')
      }
      setError(errMsg)
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
      {error && <div className="px-3 py-3 bg-brutal-red border-b border-red-900/20 text-brutal-white text-sm">{error}</div>}
      <div className="px-3 py-2 border-t-2 border-brutal-yellow bg-brutal-black flex items-center justify-evenly w-full">
        <span className="text-[11px] text-white/80 inline-flex items-center gap-[5px] whitespace-nowrap">
          <kbd className="inline-block px-[5px] py-[2px] bg-[#222] border border-[#555] font-mono text-[10px] font-medium text-white/80">↑↓</kbd> Navigate <kbd className="inline-block px-[5px] py-[2px] bg-[#222] border border-[#555] font-mono text-[10px] font-medium text-white/80">Enter</kbd> Execute <kbd className="inline-block px-[5px] py-[2px] bg-[#222] border border-[#555] font-mono text-[10px] font-medium text-white/80">Esc</kbd> Back
        </span>
      </div>
    </>
  )
}

export default EntryActions
