import { useEffect, useRef } from 'react'
import { LucideIcon } from 'lucide-react'

interface PaletteInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder: string
  type?: 'text' | 'password'
  icon?: LucideIcon
  autoFocus?: boolean
  hint?: string
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
}: PaletteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="palette-input-container">
      <div className="palette-input-wrapper">
        {Icon && <Icon className="palette-input-icon" size={20} />}
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="palette-input"
        />
        {hint && <span className="palette-input-hint">{hint}</span>}
      </div>
    </div>
  )
}

export default PaletteInput
