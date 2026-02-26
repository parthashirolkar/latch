import { useState } from 'react'
import { AlertTriangle, ArrowRight, Copy, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { HealthList } from './HealthList'

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
        <button className="settings-list-item warning">
          <div className="settings-list-item-content">
            <AlertTriangle size={18} />
            <span>Password used {reused.count} times</span>
          </div>
          <div className="settings-list-item-meta">
            <span>{reused.entries.length} accounts</span>
            <ArrowRight size={16} />
          </div>
        </button>
      )}
      renderExpandedContent={(reused, index) => (
        <div className="settings-expandable-content">
          <div className="settings-expandable-field">
            <span className="settings-expandable-label">Password:</span>
            <div className="settings-expandable-value-row">
              <code className="settings-expandable-value">
                {visiblePasswords.has(index) ? reused.password : '•'.repeat(Math.min(reused.password.length, 20))}
              </code>
              <button
                className="settings-icon-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  togglePasswordVisibility(index)
                }}
                title={visiblePasswords.has(index) ? 'Hide password' : 'Show password'}
              >
                {visiblePasswords.has(index) ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                className="settings-icon-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(reused.password)
                }}
                title="Copy password"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>

          <div className="settings-expandable-field">
            <span className="settings-expandable-label">Used on {reused.entries.length} accounts:</span>
            <div className="settings-expandable-accounts">
              {reused.entries.map((entry) => (
                <button
                  key={entry.entry_id}
                  className="settings-expandable-account"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectEntry(entry.entry_id)
                  }}
                >
                  <span>{entry.title}</span>
                  <ExternalLink size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    />
  )
}
