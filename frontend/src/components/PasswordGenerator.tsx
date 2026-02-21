import { useState, useEffect, useRef } from 'react'
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

  useEffect(() => {
    generatePassword()
  }, [options])

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const generatePassword = async () => {
    try {
      const result = await invoke('generate_password', {
        length: options.length,
        uppercase: options.uppercase,
        lowercase: options.lowercase,
        numbers: options.numbers,
        symbols: options.symbols,
        excludeAmbiguous: options.excludeAmbiguous
      })
      const response = JSON.parse(result as string)
      if (response.status === 'success' && response.password) {
        setGeneratedPassword(response.password)
      }
    } catch (error) {
      console.error('Failed to generate password:', error)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedPassword)
    setCopied(true)
  }

  const handleUsePassword = () => {
    onPasswordSelect(generatedPassword)
  }

  const toggleOption = (key: keyof PasswordOptions) => {
    if (key === 'length') return
    setOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleLengthChange = (delta: number) => {
    const newLength = Math.max(8, Math.min(128, options.length + delta))
    setOptions(prev => ({ ...prev, length: newLength }))
  }

  const handleKeyDown = (e: Event) => {
    const keyboardEvent = e as KeyboardEvent
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
  }

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener('keydown', handleKeyDown)
      return () => container.removeEventListener('keydown', handleKeyDown)
    }
  }, [options, generatedPassword])

  return (
    <div ref={containerRef} className="password-generator">
      <div className="password-display">
        <div className="password-text">{generatedPassword || 'Generating...'}</div>
      </div>

      <StrengthMeter password={generatedPassword} showEntropy />

      <div className="password-options">
        <div className="option-slider">
          <span className="option-label">Length</span>
          <div className="slider-controls">
            <button
              className="slider-button"
              onClick={() => handleLengthChange(-4)}
              disabled={options.length <= 8}
            >
              −
            </button>
            <span className="length-value">{options.length}</span>
            <button
              className="slider-button"
              onClick={() => handleLengthChange(4)}
              disabled={options.length >= 128}
            >
              +
            </button>
          </div>
        </div>

        <label className="option-checkbox">
          <input
            type="checkbox"
            checked={options.uppercase}
            onChange={() => toggleOption('uppercase')}
          />
          <span>Uppercase (A-Z)</span>
        </label>

        <label className="option-checkbox">
          <input
            type="checkbox"
            checked={options.lowercase}
            onChange={() => toggleOption('lowercase')}
          />
          <span>Lowercase (a-z)</span>
        </label>

        <label className="option-checkbox">
          <input
            type="checkbox"
            checked={options.numbers}
            onChange={() => toggleOption('numbers')}
          />
          <span>Numbers (0-9)</span>
        </label>

        <label className="option-checkbox">
          <input
            type="checkbox"
            checked={options.symbols}
            onChange={() => toggleOption('symbols')}
          />
          <span>Symbols (!@#$%^&*)</span>
        </label>

        <label className="option-checkbox">
          <input
            type="checkbox"
            checked={options.excludeAmbiguous}
            onChange={() => toggleOption('excludeAmbiguous')}
          />
          <span>Exclude ambiguous (0,O,1,l,I)</span>
        </label>
      </div>

      <div className="generator-actions">
        <button className="action-button" onClick={generatePassword}>
          <Shuffle size={16} />
          Regenerate
        </button>
        <button className="action-button" onClick={handleCopy}>
          <Copy size={16} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button className="action-button primary" onClick={handleUsePassword}>
          <Check size={16} />
          Use Password
        </button>
      </div>

      <div className="generator-footer">
        <kbd>Space</kbd> Regenerate <kbd>↑/↓</kbd> Adjust length <kbd>Enter</kbd> Confirm <kbd>Esc</kbd> Cancel
      </div>
    </div>
  )
}
