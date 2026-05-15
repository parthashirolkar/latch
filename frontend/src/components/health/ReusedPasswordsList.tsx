import { useState } from 'react'
import { AlertTriangle, ArrowRight, Copy, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { HealthList } from './HealthList'
import { useClipboardGuard } from '../../hooks/useClipboardGuard'

interface ReusedEntry {
  entry_id: string
  title: string
  username: string
}

interface ReusedPassword {
  password: string
  entries: ReusedEntry[]
  count: number
}

interface ReusedPasswordsListProps {
  onSelectEntry: (entryId: string) => void
}

export default function ReusedPasswordsList({ onSelectEntry }: ReusedPasswordsListProps) {
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set())
  const { copy } = useClipboardGuard()

  const togglePasswordVisibility = (index: number) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <HealthList<ReusedPassword>
      title="Reused Passwords"
      fetchKey="reused_passwords"
      emptyMessage="No reused passwords found!"
      instruction="These passwords are used on multiple accounts. Consider using unique passwords for each site."
      badgeColor="#ffa500"
      badgeBgColor="#ffa50020"
      renderBadge={(count) => `${count} set${count !== 1 ? 's' : ''}`}
      renderItem={(reused, _index) => (
        <button className="flex items-center justify-between gap-4 px-4 py-3 bg-[#4A3300] border-2 border-brutal-yellow cursor-pointer transition-transform duration-100 shadow-[6px_6px_0px_var(--color-brutal-yellow)] hover:bg-[#FFE299] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_var(--color-brutal-yellow)] w-full text-left">
          <div className="flex items-center gap-3 text-[#FFB84D] font-extrabold min-w-0 flex-1">
            <AlertTriangle size={18} />
            <span>Password used {reused.count} times</span>
          </div>
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <span>{reused.entries.length} accounts</span>
            <ArrowRight size={16} />
          </div>
        </button>
      )}
      renderExpandedContent={(reused, index) => (
        <div>
          <div className="mb-4">
            <span className="block text-xs text-brutal-gray uppercase tracking-wider mb-2 font-semibold">Password:</span>
            <div className="flex items-center gap-3">
              <code className="font-mono text-xl tracking-wider text-brutal-yellow bg-brutal-black px-4 py-3 border border-brutal-yellow break-all flex-1">
                {visiblePasswords.has(index) ? reused.password : '•'.repeat(Math.min(reused.password.length, 20))}
              </code>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  togglePasswordVisibility(index)
                }}
                title={visiblePasswords.has(index) ? 'Hide password' : 'Show password'}
                className="flex items-center justify-center w-11 h-11 bg-brutal-black border-2 border-brutal-yellow text-brutal-white cursor-pointer transition-transform duration-100 hover:bg-brutal-yellow hover:text-white shadow-[2px_2px_0px_var(--color-brutal-yellow)]"
              >
                {visiblePasswords.has(index) ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  copy(reused.password)
                }}
                title="Copy password"
                className="flex items-center justify-center w-11 h-11 bg-brutal-black border-2 border-brutal-yellow text-brutal-white cursor-pointer transition-transform duration-100 hover:bg-brutal-yellow hover:text-white shadow-[2px_2px_0px_var(--color-brutal-yellow)]"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>

          <div className="mb-4">
            <span className="block text-xs text-brutal-gray uppercase tracking-wider mb-2 font-semibold">Used on {reused.entries.length} accounts:</span>
            <div className="flex flex-col gap-2">
              {reused.entries.map((entry) => (
                <button
                  key={entry.entry_id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectEntry(entry.entry_id)
                  }}
                  className="flex items-center justify-between px-4 py-3 bg-brutal-black border-2 border-brutal-yellow text-brutal-white font-extrabold font-mono cursor-pointer transition-transform duration-100 shadow-[4px_4px_0px_var(--color-brutal-yellow)] hover:bg-[#222] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brutal-yellow)]"
                >
                  <span>{entry.title}</span>
                  <ExternalLink size={14} className="text-brutal-yellow opacity-50 transition-opacity duration-200 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    />
  )
}
