import { useState, useEffect, useCallback } from 'react'
import { Search, Lock } from 'lucide-react'
import { useSearch } from '../../hooks/useSearch'
import { useDebounce } from '../../hooks/useDebounce'
import { useKeyboardNav } from '../../hooks/useKeyboardNav'
import PaletteInput from '../PaletteInput'
import PaletteList from '../PaletteList'
import { type PaletteMode, type CredentialPreview } from '../../api/types'

interface SearchModeProps {
  onModeChange: (mode: PaletteMode, entry?: CredentialPreview, prefillTitle?: string) => void
  onLock: () => void
  searchTrigger: number
}

function SearchMode({ onModeChange, onLock, searchTrigger }: SearchModeProps) {
  const { searchResults, setSearchResults, isLoading, handleSearch } = useSearch()
  const [inputValue, setInputValue] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null)
  const debouncedInputValue = useDebounce(inputValue, 300)

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchResults])

  useEffect(() => {
    if (debouncedInputValue.length >= 2) {
      handleSearch(debouncedInputValue)
    } else {
      setSearchResults([])
    }
  }, [debouncedInputValue, handleSearch, setSearchResults])

  useEffect(() => {
    if (searchTrigger > 0) {
      setInputValue('')
      setSearchResults([])
      setSelectedIndex(0)
    }
  }, [searchTrigger, setSearchResults])

  useEffect(() => {
    if (searchResults.length > 0 && selectedIndex >= 0) {
      const selectedEntry = searchResults[selectedIndex]
      if (selectedEntry) {
        setHoveredEntryId(selectedEntry.id)
      }
    } else {
      setHoveredEntryId(null)
    }
  }, [selectedIndex, searchResults])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === 'Backspace' && hoveredEntryId) {
        e.preventDefault()
        const entry = searchResults.find((ent) => ent.id === hoveredEntryId)
        if (entry) {
          onModeChange('delete-confirm', entry)
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        onLock()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault()
        onModeChange('password-generator')
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault()
        onModeChange('vault-health')
      } else if (e.key === ',') {
        e.preventDefault()
        onModeChange('settings')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hoveredEntryId, searchResults, onModeChange, onLock])

  const handleEnterKey = useCallback(() => {
    if (searchResults.length > 0) {
      const selected = searchResults[selectedIndex]
      onModeChange('actions', selected)
    } else if (inputValue.length > 0) {
      onModeChange('add-entry', undefined, inputValue)
    }
  }, [searchResults, selectedIndex, inputValue, onModeChange])

  const handleEscape = useCallback(() => {
    if (inputValue.length > 0) {
      setInputValue('')
    }
  }, [inputValue])

  useKeyboardNav({
    itemCount: searchResults.length,
    selectedIndex,
    onSelectedIndexChange: setSelectedIndex,
    onEnter: handleEnterKey,
    onEscape: handleEscape,
    enabled: true,
  })

  const currentItems = searchResults.map((entry) => ({
    id: entry.id,
    title: entry.title,
    subtitle: entry.username,
    icon: Lock,
    iconUrl: entry.icon_url ?? undefined,
  }))

  const showList = searchResults.length > 0

  return (
    <>
      <PaletteInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={undefined}
        placeholder={inputValue ? 'Search passwords...' : 'Type to search...'}
        type="text"
        icon={Search}
        autoFocus={true}
        disabled={false}
        iconSpin={isLoading}
      />

      {showList && (
        <PaletteList
          items={currentItems}
          selectedIndex={selectedIndex}
          onItemHover={setHoveredEntryId}
          onSelect={(_item, index) => {
            const selected = searchResults[index]
            setSelectedIndex(index)
            if (selected) {
              onModeChange('actions', selected)
            }
          }}
        />
      )}

      <div className="px-3 py-2 border-t-2 border-theme-accent bg-theme-bg flex items-center justify-evenly w-full">
        {searchResults.length > 0 ? (
          <span className="text-[11px] text-theme-text-secondary inline-flex items-center gap-[5px] whitespace-nowrap">
            <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">↑↓</kbd> Navigate <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Enter</kbd> Select <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Shift+Backspace</kbd> Delete <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Esc</kbd> Clear <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">,</kbd> Settings <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Ctrl+H</kbd> Health
          </span>
        ) : (
          <span className="text-[11px] text-theme-text-secondary inline-flex items-center gap-[5px] whitespace-nowrap">
            <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Enter</kbd> Add New Password <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Esc</kbd> Hide <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Ctrl+G</kbd> Generate <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Ctrl+H</kbd> Health <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">,</kbd> Settings
          </span>
        )}
      </div>
    </>
  )
}

export default SearchMode



