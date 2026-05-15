import { AlertTriangle, ArrowRight, Copy } from 'lucide-react'
import { HealthList } from './HealthList'
import { useClipboardGuard } from '../../hooks/useClipboardGuard'

interface WeakPassword {
  entry_id: string
  title: string
  username: string
  score: number
  entropy: number
  label: string
}

interface WeakPasswordsListProps {
  onSelectEntry: (entryId: string) => void
}

const getStrengthLabel = (score: number) => {
  if (score >= 4) return 'Very Strong'
  if (score >= 3) return 'Strong'
  if (score >= 2) return 'Fair'
  if (score >= 1) return 'Weak'
  return 'Very Weak'
}

export default function WeakPasswordsList({ onSelectEntry }: WeakPasswordsListProps) {
  const { copy } = useClipboardGuard()

  return (
    <HealthList<WeakPassword>
      title="Weak Passwords"
      fetchKey="weak_passwords"
      emptyMessage="No weak passwords found!"
      instruction="These passwords are weak or easy to guess. Consider updating them with stronger alternatives."
      badgeColor="#ff4d4d"
      badgeBgColor="#ff4d4d20"
      renderBadge={(count) => count}
      renderItem={(weak, _index) => (
        <button className="flex items-center justify-between gap-4 px-4 py-3 bg-brutal-red border-2 border-brutal-yellow cursor-pointer transition-transform duration-100 shadow-[6px_6px_0px_var(--color-brutal-yellow)] hover:bg-[#FFB5B5] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_var(--color-brutal-yellow)] w-full text-left">
          <div className="flex items-center gap-3 text-brutal-white font-extrabold min-w-0 flex-1">
            <AlertTriangle size={18} />
            <span>{weak.title}</span>
          </div>
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <span>{getStrengthLabel(weak.score)}</span>
            <ArrowRight size={16} />
          </div>
        </button>
      )}
      renderExpandedContent={(weak, _index) => (
        <div>
          {weak.username && (
            <div className="mb-4">
              <span className="block text-xs text-brutal-gray uppercase tracking-wider mb-2 font-semibold">Username:</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl tracking-wider text-brutal-yellow bg-brutal-black px-4 py-3 border border-brutal-yellow break-all flex-1">
                  {weak.username}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    copy(weak.username)
                  }}
                  title="Copy username"
                  className="flex items-center justify-center w-11 h-11 bg-brutal-black border-2 border-brutal-yellow text-brutal-white cursor-pointer transition-transform duration-100 hover:bg-brutal-yellow hover:text-white shadow-[2px_2px_0px_var(--color-brutal-yellow)]"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <span className="block text-xs text-brutal-gray uppercase tracking-wider mb-2 font-semibold">Strength:</span>
            <div className="mt-1" style={{ color: '#ff4d4d', fontSize: 'var(--font-sm)' }}>
              {weak.label} ({Math.round(weak.entropy)} bits)
            </div>
          </div>

          <button
            className="w-full px-5 py-2.5 bg-brutal-yellow text-brutal-black border-2 border-brutal-yellow font-extrabold font-mono uppercase tracking-wider cursor-pointer transition-transform duration-100 hover:bg-brutal-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brutal-yellow)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none mt-3"
            onClick={(e) => {
              e.stopPropagation()
              onSelectEntry(weak.entry_id)
            }}
          >
            Update Password
          </button>
        </div>
      )}
    />
  )
}
