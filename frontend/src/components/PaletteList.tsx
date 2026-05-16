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
      <div className="p-10 text-center text-theme-text-secondary font-theme">
        <span>{emptyMessage}</span>
      </div>
    )
  }

  return (
    <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-theme-accent [&::-webkit-scrollbar-thumb]:rounded-none">
      {items.map((item, index) => (
        <div
          key={item.id}
          ref={index === selectedIndex ? selectedRef : null}
          onClick={() => onSelect(item, index)}
          onMouseEnter={() => onItemHover?.(item.id)}
          onMouseLeave={() => onItemHover?.(null)}
          className={`flex items-center px-4 py-3 gap-3 cursor-pointer transition-all duration-100 border-b border-theme-border ${
            index === selectedIndex
              ? 'bg-theme-accent text-theme-bg'
              : 'text-theme-text hover:bg-theme-surface'
          }`}
        >
          {item.iconUrl && !failedIcons.has(item.iconUrl) ? (
            <img
              src={item.iconUrl}
              alt=""
              onError={() => {
                setFailedIcons((prev) => new Set(prev).add(item.iconUrl!))
              }}
              className="w-[18px] h-[18px] flex-shrink-0 rounded-[3px] object-contain"
            />
          ) : item.icon ? (
            <item.icon
              className={`flex-shrink-0 ${index === selectedIndex ? 'text-theme-bg' : 'text-theme-text-secondary'}`}
              size={18}
            />
          ) : null}
          <div className="flex-1 min-w-0">
            <div className={`text-[15px] font-medium truncate ${index === selectedIndex ? 'text-theme-bg' : 'text-theme-text'}`}>
              {item.title}
            </div>
            {item.subtitle && (
              <div className={`text-[13px] truncate font-theme font-normal ${index === selectedIndex ? 'text-theme-bg/80' : 'text-theme-text-secondary'}`}>
                {item.subtitle}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default PaletteList



