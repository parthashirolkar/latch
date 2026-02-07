import { useEffect, useRef, type RefObject } from 'react'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'

const WINDOW_WIDTH = 640
const MIN_HEIGHT = 50
const MAX_HEIGHT = 600

export function useWindowAutoResize(containerRef: RefObject<HTMLElement | null>) {
  const lastHeight = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const resize = () => {
      const contentHeight = el.scrollHeight
      const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, contentHeight + 2))

      if (clamped !== lastHeight.current) {
        lastHeight.current = clamped
        getCurrentWindow()
          .setSize(new LogicalSize(WINDOW_WIDTH, clamped))
          .catch(() => {})
      }
    }

    const observer = new ResizeObserver(() => resize())
    observer.observe(el)
    resize()

    return () => observer.disconnect()
  }, [containerRef])
}
