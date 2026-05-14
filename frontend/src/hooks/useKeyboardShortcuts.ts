import { useEffect, useCallback } from 'react'

interface UseKeyboardShortcutsProps {
  onEscape: () => void
  enabled?: boolean
}

export function useKeyboardShortcuts({
  onEscape,
  enabled = true
}: UseKeyboardShortcutsProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return
    if (e.key === 'Escape') {
      e.preventDefault()
      onEscape()
    }
  }, [enabled, onEscape])

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])
}
