import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api/client'
import { Shuffle, Copy, Check } from 'lucide-react'
import StrengthMeter from './StrengthMeter'
import { useClipboardGuard } from '../hooks/useClipboardGuard'

interface PasswordGeneratorProps {
  onPasswordSelect: (password: string) => void
  onCancel: () => void
  initialLength?: number
}

interface PasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
  exclude_ambiguous: boolean
}

export default function PasswordGenerator({
  onPasswordSelect,
  onCancel,
  initialLength = 16
}: PasswordGeneratorProps) {
  const [options, setOptions] = useState<PasswordOptions>({
    length: initialLength,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    exclude_ambiguous: false
  })
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { copy } = useClipboardGuard()

  const generatePassword = useCallback(async () => {
    try {
      const password = await api.generatePassword({
        length: options.length,
        uppercase: options.uppercase,
        lowercase: options.lowercase,
        numbers: options.numbers,
        symbols: options.symbols,
        exclude_ambiguous: options.exclude_ambiguous,
      })
      setGeneratedPassword(password)
    } catch (error) {
      console.error('Failed to generate password:', error)
    }
  }, [options.length, options.uppercase, options.lowercase, options.numbers, options.symbols, options.exclude_ambiguous])

  const handleCopy = useCallback(async () => {
    await copy(generatedPassword)
    setCopied(true)
  }, [copy, generatedPassword])

  const handleUsePassword = useCallback(() => {
    onPasswordSelect(generatedPassword)
  }, [onPasswordSelect, generatedPassword])

  const toggleOption = (key: keyof PasswordOptions) => {
    if (key === 'length') return
    setOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleLengthChange = useCallback((delta: number) => {
    const newLength = Math.max(8, Math.min(128, options.length + delta))
    setOptions(prev => ({ ...prev, length: newLength }))
  }, [options.length])

  const handleKeyDown = useCallback((e: Event) => {
    const keyboardEvent = e as KeyboardEvent
    const target = keyboardEvent.target as HTMLElement

    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
      return
    }

    switch (keyboardEvent.key) {
      case 'Enter':
        handleUsePassword()
        break
      case 'Escape':
        onCancel()
        break
      case ' ':
        keyboardEvent.preventDefault()
        generatePassword()
        break
      case 'ArrowUp':
        keyboardEvent.preventDefault()
        handleLengthChange(4)
        break
      case 'ArrowDown':
        keyboardEvent.preventDefault()
        handleLengthChange(-4)
        break
    }
  }, [handleUsePassword, onCancel, generatePassword, handleLengthChange])

  useEffect(() => {
    generatePassword()
  }, [generatePassword])

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.focus()
      container.addEventListener('keydown', handleKeyDown)
      return () => container.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return (
    <div ref={containerRef} className="px-4 py-6 flex flex-col gap-4 bg-theme-bg" tabIndex={-1}>
      <div className="bg-theme-bg border-2 border-theme-accent p-4 mb-2 shadow-theme">
        <div className="font-password text-base text-theme-text text-center break-all tracking-wide py-1">
          {generatedPassword || 'Generating...'}
        </div>
      </div>

      <StrengthMeter password={generatedPassword} showEntropy />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <label className="text-base text-theme-text font-theme">Length</label>
          <input
            type="range"
            min="8"
            max="128"
            step="4"
            value={options.length}
            onChange={(e) => setOptions(prev => ({ ...prev, length: parseInt(e.target.value) }))}
            className="flex-1 h-1 bg-theme-surface-hover rounded outline-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-theme-accent [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-100 [&::-webkit-slider-thumb]:hover:scale-110"
          />
          <span className="font-theme text-sm text-theme-text-secondary min-w-[32px] text-right">{options.length}</span>
        </div>

        <label className="flex items-center justify-between gap-3 cursor-pointer select-none text-theme-text font-theme">
          <span className="flex-1">Uppercase (A-Z)</span>
          <input
            type="checkbox"
            checked={options.uppercase}
            onChange={() => toggleOption('uppercase')}
            className="w-[18px] h-[18px] accent-theme-accent cursor-pointer flex-shrink-0"
          />
        </label>

        <label className="flex items-center justify-between gap-3 cursor-pointer select-none text-theme-text font-theme">
          <span className="flex-1">Lowercase (a-z)</span>
          <input
            type="checkbox"
            checked={options.lowercase}
            onChange={() => toggleOption('lowercase')}
            className="w-[18px] h-[18px] accent-theme-accent cursor-pointer flex-shrink-0"
          />
        </label>

        <label className="flex items-center justify-between gap-3 cursor-pointer select-none text-theme-text font-theme">
          <span className="flex-1">Numbers (0-9)</span>
          <input
            type="checkbox"
            checked={options.numbers}
            onChange={() => toggleOption('numbers')}
            className="w-[18px] h-[18px] accent-theme-accent cursor-pointer flex-shrink-0"
          />
        </label>

        <label className="flex items-center justify-between gap-3 cursor-pointer select-none text-theme-text font-theme">
          <span className="flex-1">Symbols (!@#$%^&*)</span>
          <input
            type="checkbox"
            checked={options.symbols}
            onChange={() => toggleOption('symbols')}
            className="w-[18px] h-[18px] accent-theme-accent cursor-pointer flex-shrink-0"
          />
        </label>

        <label className="flex items-center justify-between gap-3 cursor-pointer select-none text-theme-text font-theme">
          <span className="flex-1">Exclude ambiguous (0,O,1,l,I)</span>
          <input
            type="checkbox"
            checked={options.exclude_ambiguous}
            onChange={() => toggleOption('exclude_ambiguous')}
            className="w-[18px] h-[18px] accent-theme-accent cursor-pointer flex-shrink-0"
          />
        </label>
      </div>

      <div className="flex gap-2 mt-2">
        <button onClick={generatePassword} className="flex-1 px-3 py-2 bg-theme-bg text-theme-text border-2 border-theme-accent font-medium font-theme text-sm cursor-pointer transition-all duration-100 shadow-theme-sm hover:bg-theme-surface active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">
          <Shuffle size={14} className="inline mr-1" />
          Regenerate
        </button>
        <button onClick={handleCopy} className="flex-1 px-3 py-2 bg-theme-bg text-theme-text border-2 border-theme-accent font-medium font-theme text-sm cursor-pointer transition-all duration-100 shadow-theme-sm hover:bg-theme-surface active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">
          <Copy size={14} className="inline mr-1" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button onClick={handleUsePassword} className="flex-1 px-3 py-2 bg-theme-accent text-theme-bg border-2 border-theme-accent font-medium font-theme text-sm cursor-pointer transition-all duration-100 shadow-theme-sm hover:bg-theme-text active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">
          <Check size={14} className="inline mr-1" />
          Use Password
        </button>
      </div>

      <div className="text-center text-sm text-theme-text-secondary font-theme mt-2">
        <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Space</kbd> Regenerate <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">↑/↓</kbd> Adjust length <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Enter</kbd> Confirm <kbd className="inline-block px-[5px] py-[2px] bg-theme-surface border border-theme-border font-theme text-[10px] font-medium text-theme-text-secondary">Esc</kbd> Cancel
      </div>
    </div>
  )
}



