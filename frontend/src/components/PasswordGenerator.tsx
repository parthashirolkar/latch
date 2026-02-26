import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Shuffle, Copy, Check } from 'lucide-react'
import StrengthMeter from './StrengthMeter'

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
  excludeAmbiguous: boolean
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
    excludeAmbiguous: false
  })
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const generatePassword = useCallback(async () => {
    try {
      const result = await invoke('generate_password', {
        options: {
          length: options.length,
          uppercase: options.uppercase,
          lowercase: options.lowercase,
          numbers: options.numbers,
          symbols: options.symbols,
          exclude_ambiguous: options.excludeAmbiguous
        }
      })
      const response = JSON.parse(result as string)
      if (response.status === 'success' && response.password) {
        setGeneratedPassword(response.password)
      }
    } catch (error) {
      console.error('Failed to generate password:', error)
    }
  }, [options.length, options.uppercase, options.lowercase, options.numbers, options.symbols, options.excludeAmbiguous])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(generatedPassword)
    setCopied(true)
  }, [generatedPassword])

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

    // Don't handle keyboard events if focus is on the range slider
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'range') {
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
      container.addEventListener('keydown', handleKeyDown)
      return () => container.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return (
    <div ref={containerRef} className="password-generator">
      <div className="password-generator-display">
        <div className="password-generator-value">{generatedPassword || 'Generating...'}</div>
      </div>

      <StrengthMeter password={generatedPassword} showEntropy />

      <div className="password-generator-options">
        <div className="password-generator-slider">
          <label>Length</label>
          <input
            type="range"
            min="8"
            max="128"
            step="4"
            value={options.length}
            onChange={(e) => setOptions(prev => ({ ...prev, length: parseInt(e.target.value) }))}
          />
          <span className="password-generator-slider-value">{options.length}</span>
        </div>

        <label className="password-generator-option">
          <input
            type="checkbox"
            checked={options.uppercase}
            onChange={() => toggleOption('uppercase')}
          />
          <span>Uppercase (A-Z)</span>
        </label>

        <label className="password-generator-option">
          <input
            type="checkbox"
            checked={options.lowercase}
            onChange={() => toggleOption('lowercase')}
          />
          <span>Lowercase (a-z)</span>
        </label>

        <label className="password-generator-option">
          <input
            type="checkbox"
            checked={options.numbers}
            onChange={() => toggleOption('numbers')}
          />
          <span>Numbers (0-9)</span>
        </label>

        <label className="password-generator-option">
          <input
            type="checkbox"
            checked={options.symbols}
            onChange={() => toggleOption('symbols')}
          />
          <span>Symbols (!@#$%^&*)</span>
        </label>

        <label className="password-generator-option">
          <input
            type="checkbox"
            checked={options.excludeAmbiguous}
            onChange={() => toggleOption('excludeAmbiguous')}
          />
          <span>Exclude ambiguous (0,O,1,l,I)</span>
        </label>
      </div>

      <div className="password-generator-actions">
        <button className="password-generator-button password-generator-button-secondary" onClick={generatePassword}>
          <Shuffle size={16} />
          Regenerate
        </button>
        <button className="password-generator-button password-generator-button-secondary" onClick={handleCopy}>
          <Copy size={16} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button className="password-generator-button password-generator-button-primary" onClick={handleUsePassword}>
          <Check size={16} />
          Use Password
        </button>
      </div>

      <div style={{ textAlign: 'center', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginTop: '8px' }}>
        <kbd>Space</kbd> Regenerate <kbd>↑/↓</kbd> Adjust length <kbd>Enter</kbd> Confirm <kbd>Esc</kbd> Cancel
      </div>
    </div>
  )
}
