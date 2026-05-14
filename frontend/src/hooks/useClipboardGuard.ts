import { useRef, useCallback } from 'react'

const DEFAULT_DURATION_MS = 30_000

export function useClipboardGuard(durationMs: number = DEFAULT_DURATION_MS) {
  const timeoutRef = useRef<number | null>(null)

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = window.setTimeout(async () => {
      try {
        const currentText = await navigator.clipboard.readText()
        if (currentText === text) {
          await navigator.clipboard.writeText('')
        }
      } catch {
        // clipboard read may be denied by OS/browser
      }
    }, durationMs)
  }, [durationMs])

  const cancel = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  return { copy, cancel }
}
