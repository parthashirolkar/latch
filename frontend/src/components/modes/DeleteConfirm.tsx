import { useState, useCallback } from 'react'
import { Trash2, Search } from 'lucide-react'
import { api } from '../../api/client'
import { useKeyboardNav } from '../../hooks/useKeyboardNav'
import PaletteList from '../PaletteList'
import { type PaletteMode, type CredentialPreview } from '../../api/types'

interface DeleteConfirmProps {
  entry: CredentialPreview
  onModeChange: (mode: PaletteMode) => void
  onCredentialsChanged: () => void
}

function DeleteConfirm({ entry, onModeChange, onCredentialsChanged }: DeleteConfirmProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const items = [
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

  const handleDelete = useCallback(async () => {
    try {
      await api.deleteEntry(entry.id)
      onCredentialsChanged()
      onModeChange('search')
    } catch (error) {
      console.error('Failed to delete entry:', error)
    }
  }, [entry.id, onModeChange, onCredentialsChanged])

  const handleEnter = useCallback(() => {
    if (selectedIndex === 0) {
      handleDelete()
    } else {
      onModeChange('search')
    }
  }, [selectedIndex, handleDelete, onModeChange])

  const handleEscape = useCallback(() => {
    onModeChange('search')
  }, [onModeChange])

  useKeyboardNav({
    itemCount: items.length,
    selectedIndex,
    onSelectedIndexChange: setSelectedIndex,
    onEnter: handleEnter,
    onEscape: handleEscape,
    enabled: true,
  })

  return (
    <>
      <PaletteList
        items={items}
        selectedIndex={selectedIndex}
        onSelect={(_item, index) => {
          setSelectedIndex(index)
          if (index === 0) {
            handleDelete()
          } else {
            onModeChange('search')
          }
        }}
      />
      <div className="px-3 py-2 border-t-2 border-theme-accent bg-theme-bg flex items-center justify-evenly w-full">
        <span className="text-[11px] text-theme-text-secondary inline-flex items-center gap-[5px] whitespace-nowrap">
          <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">↑↓</kbd> Navigate <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Enter</kbd> Confirm <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Esc</kbd> Cancel
        </span>
      </div>
    </>
  )
}

export default DeleteConfirm



