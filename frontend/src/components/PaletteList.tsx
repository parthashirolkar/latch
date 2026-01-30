import { useEffect, useRef, useState } from 'react'
import { LucideIcon } from 'lucide-react'

export interface PaletteListItem {
  id: string
  title: string
  subtitle?: string
  icon?: LucideIcon
  iconUrl?: string
}

interface PaletteListProps {
  items: PaletteListItem[]
  selectedIndex: number
  onSelect: (item: PaletteListItem, index: number) => void
  emptyMessage?: string
  onItemHover?: (itemId: string | null) => void
}

function PaletteList({ items, selectedIndex, onSelect, emptyMessage = 'No results', onItemHover }: PaletteListProps) {
  const selectedRef = useRef<HTMLDivElement>(null)
  const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set())

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
          onMouseEnter={() => onItemHover?.(item.id)}
          onMouseLeave={() => onItemHover?.(null)}
        >
          {item.iconUrl && !failedIcons.has(item.iconUrl) ? (
            <img
              src={item.iconUrl}
              alt=""
              className="palette-list-item-icon-img"
              onError={() => {
                console.log('Favicon failed to load:', item.iconUrl)
                setFailedIcons((prev) => new Set(prev).add(item.iconUrl!))
              }}
            />
          ) : item.icon ? (
            <item.icon className="palette-list-item-icon" size={18} />
          ) : null}
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
