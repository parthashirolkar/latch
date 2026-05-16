import { AlertOctagon, ArrowRight, ExternalLink, Copy } from 'lucide-react'
import { HealthList } from './HealthList'
import { useClipboardGuard } from '../../hooks/useClipboardGuard'

interface BreachedCredential {
  entry_id: string
  title: string
  username: string
  breach_count: number
}

interface BreachedCredentialsListProps {
  onSelectEntry: (entryId: string) => void
}

export default function BreachedCredentialsList({ onSelectEntry }: BreachedCredentialsListProps) {
  const { copy } = useClipboardGuard()

  return (
    <HealthList<BreachedCredential>
      title="Breached Credentials"
      fetchKey="breached_credentials"
      emptyMessage="No breached credentials found!"
      instruction="These passwords have appeared in known data breaches. Update them immediately to secure your accounts."
      badgeColor="#ff4d4d"
      badgeBgColor="#ff4d4d20"
      renderBadge={(count) => count}
      renderItem={(breached, _index) => (
        <button className="flex items-center justify-between gap-4 px-4 py-3 bg-theme-danger border-2 border-theme-accent cursor-pointer transition-transform duration-100 shadow-theme hover:bg-theme-danger hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm w-full text-left">
          <div className="flex items-center gap-3 text-theme-text font-extrabold min-w-0 flex-1">
            <AlertOctagon size={18} />
            <span>{breached.title}</span>
          </div>
          <div className="flex items-center gap-2 text-theme-text-secondary text-sm">
            <span>{breached.breach_count} breach{breached.breach_count !== 1 ? 'es' : ''}</span>
            <ArrowRight size={16} />
          </div>
        </button>
      )}
      renderExpandedContent={(breached, _index) => (
        <div>
          {breached.username && (
            <div className="mb-4">
              <span className="block text-xs text-theme-text-secondary uppercase tracking-wider mb-2 font-semibold">Username:</span>
              <div className="flex items-center gap-3">
                <span className="font-password text-xl tracking-wider text-theme-accent bg-theme-bg px-4 py-3 border border-theme-accent break-all flex-1">
                  {breached.username}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    copy(breached.username)
                  }}
                  title="Copy username"
                  className="flex items-center justify-center w-11 h-11 bg-theme-bg border-2 border-theme-accent text-theme-text cursor-pointer transition-transform duration-100 hover:bg-theme-accent hover:text-theme-accent-text shadow-theme-sm"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}

          <button
            className="w-full px-5 py-2.5 bg-theme-accent text-theme-bg border-2 border-theme-accent font-extrabold font-theme uppercase tracking-wider cursor-pointer transition-transform duration-100 hover:bg-theme-text hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none mt-3"
            onClick={(e) => {
              e.stopPropagation()
              onSelectEntry(breached.entry_id)
            }}
          >
            Update Password
          </button>

          <a
            href="https://haveibeenpwned.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full mt-2 px-5 py-2.5 bg-theme-bg text-theme-text border-2 border-theme-accent font-extrabold font-theme uppercase tracking-wider cursor-pointer transition-transform duration-100 hover:bg-theme-surface hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none flex items-center justify-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={16} />
            Learn More
          </a>
        </div>
      )}
    />
  )
}



