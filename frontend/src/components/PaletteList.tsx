import { useEffect, useRef } from 'react'

export interface PaletteListItem {
  id: string
  title: string
  subtitle?: string
  icon?: string
}

interface PaletteListProps {
  items: PaletteListItem[]
  selectedIndex: number
  onSelect: (item: PaletteListItem, index: number) => void
  emptyMessage?: string
}

function PaletteList({ items, selectedIndex, onSelect, emptyMessage = 'No results' }: PaletteListProps) {
  const selectedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  if (items.length === 0 && emptyMessage) {
    return (
      <div className="palette-list-empty">
        <span>{emptyMessage}</span>
      </div>
    )
  }

  return (
    <div className="palette-list">
      {items.map((item, index) => (
        <div
          key={item.id}
          ref={index === selectedIndex ? selectedRef : null}
          className={`palette-list-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(item, index)}
        >
          {item.icon && <span className="palette-list-item-icon">{item.icon}</span>}
          <div className="palette-list-item-content">
            <div className="palette-list-item-title">{item.title}</div>
            {item.subtitle && <div className="palette-list-item-subtitle">{item.subtitle}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export default PaletteList
