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
      <div className="p-10 text-center text-white/80 font-mono">
        <span>{emptyMessage}</span>
      </div>
    )
  }

  return (
    <div className="max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-brutal-yellow [&::-webkit-scrollbar-thumb]:rounded-none">
      {items.map((item, index) => (
        <div
          key={item.id}
          ref={index === selectedIndex ? selectedRef : null}
          onClick={() => onSelect(item, index)}
          onMouseEnter={() => onItemHover?.(item.id)}
          onMouseLeave={() => onItemHover?.(null)}
          className={`flex items-center px-5 py-4 gap-4 cursor-pointer transition-all duration-100 border-b-2 border-brutal-yellow ${
            index === selectedIndex
              ? 'bg-brutal-yellow text-brutal-black'
              : 'text-brutal-white hover:bg-[#222] hover:translate-x-[2px] hover:translate-y-[2px]'
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
              className={`flex-shrink-0 ${index === selectedIndex ? 'text-brutal-black' : 'text-white/80'}`}
              size={18}
            />
          ) : null}
          <div className="flex-1 min-w-0">
            <div className={`text-xl font-extrabold truncate uppercase ${index === selectedIndex ? 'text-brutal-black' : 'text-brutal-white'}`}>
              {item.title}
            </div>
            {item.subtitle && (
              <div className={`text-sm truncate font-mono ${index === selectedIndex ? 'text-brutal-black' : 'text-brutal-white'}`}>
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
