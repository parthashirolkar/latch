import { useEffect, useCallback } from 'react'
import { Entry } from './useSearch'
import { PaletteMode } from '../components/CommandPalette'

interface UseKeyboardShortcutsProps {
    mode: PaletteMode
    hoveredEntryId: string | null
    searchResults: Entry[]
    setEntryToDelete: (entry: Entry) => void
    setMode: (mode: PaletteMode) => void
    setSelectedIndex: (index: number) => void
    handleLock: () => void
    setEntryForGenerator: (entry: Entry | null) => void
    setInputValue: (val: string) => void
    setSearchResults: (results: Entry[]) => void
}

export function useKeyboardShortcuts({
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
}: UseKeyboardShortcutsProps) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.shiftKey && e.key === 'Backspace' && hoveredEntryId && mode === 'search') {
            e.preventDefault()
            const entry = searchResults.find((ent) => ent.id === hoveredEntryId)
            if (entry) {
                setEntryToDelete(entry)
                setMode('delete-confirm')
                setSelectedIndex(0)
            }
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'l' && mode === 'search') {
            e.preventDefault()
            handleLock()
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'g' && mode === 'search') {
            e.preventDefault()
            setEntryForGenerator(null)
            setMode('password-generator')
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'h' && mode === 'search') {
            e.preventDefault()
            setMode('vault-health')
        } else if (e.key === ',' && mode === 'search') {
            e.preventDefault()
            setMode('settings')
        } else if (e.key === 'Escape') {
            e.preventDefault()
            if (mode === 'settings') {
                setMode('search')
                setInputValue('')
                setSearchResults([])
            } else if (mode === 'vault-health') {
                setMode('search')
            } else if (mode === 'health-weak' || mode === 'health-reused' || mode === 'health-breached') {
                setMode('vault-health')
            } else if (mode === 'password-generator') {
                setEntryForGenerator(null)
                setMode('search')
            }
        }
    }, [hoveredEntryId, mode, searchResults, handleLock, setEntryToDelete, setMode, setSelectedIndex, setEntryForGenerator, setInputValue, setSearchResults])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}
