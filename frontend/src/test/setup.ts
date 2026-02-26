import '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

declare global {
  interface Window {
    clipboard: {
      writeText: ReturnType<typeof vi.fn>
    }
  }
}

Object.defineProperty(window, 'clipboard', {
  value: {
    writeText: vi.fn(),
  },
})
