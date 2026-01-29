import { useEffect, useCallback } from 'react'

interface UseKeyboardNavProps {
  itemCount: number
  selectedIndex: number
  onSelectedIndexChange: (index: number) => void
  onEnter: () => void
  onEscape: () => void
  enabled?: boolean
}

export function useKeyboardNav({
  itemCount,
  selectedIndex,
  onSelectedIndexChange,
  onEnter,
  onEscape,
  enabled = true,
}: UseKeyboardNavProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          onSelectedIndexChange(Math.min(selectedIndex + 1, itemCount - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          onSelectedIndexChange(Math.max(selectedIndex - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          onEnter()
          break
        case 'Escape':
          e.preventDefault()
          onEscape()
          break
      }
    },
    [enabled, selectedIndex, itemCount, onSelectedIndexChange, onEnter, onEscape]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])
}
