import { useEffect, useRef, useState } from 'react'
import { LucideIcon, Eye, EyeOff, Copy } from 'lucide-react'

interface PaletteInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder: string
  type?: 'text' | 'password'
  icon?: LucideIcon
  autoFocus?: boolean
  hint?: string
  disabled?: boolean
  iconSpin?: boolean
}

function PaletteInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  type = 'text',
  icon: Icon,
  autoFocus = true,
  hint,
  disabled = false,
  iconSpin = false,
}: PaletteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault()
      onSubmit()
    }
  }

  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className="palette-input-container">
      <div className="palette-input-wrapper">
        {Icon && <Icon className={iconSpin ? "palette-input-icon icon-spin" : "palette-input-icon"} size={20} />}
        <input
          ref={inputRef}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="palette-input"
          disabled={disabled}
        />
        {isPassword && value && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="settings-icon-btn"
              onClick={() => setShowPassword(!showPassword)}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              type="button"
              className="settings-icon-btn"
              onClick={() => navigator.clipboard.writeText(value)}
              title="Copy password"
            >
              <Copy size={16} />
            </button>
          </div>
        )}
        {hint && <span className="palette-input-hint">{hint}</span>}
      </div>
    </div>
  )
}

export default PaletteInput
