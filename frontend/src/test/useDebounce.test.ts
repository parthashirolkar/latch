import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../hooks/useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    expect(result.current).toBe('initial')
  })

  it('should not update value before delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    rerender({ value: 'updated', delay: 500 })
    
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current).toBe('initial')
  })

  it('should update value after delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    rerender({ value: 'updated', delay: 500 })
    
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current).toBe('updated')
  })

  it('should reset timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    rerender({ value: 'change1', delay: 500 })
    act(() => { vi.advanceTimersByTime(200) })
    
    rerender({ value: 'change2', delay: 500 })
    act(() => { vi.advanceTimersByTime(200) })
    
    rerender({ value: 'change3', delay: 500 })
    act(() => { vi.advanceTimersByTime(200) })

    expect(result.current).toBe('initial')

    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('change3')
  })
})
