import { AlertOctagon, ArrowRight, ExternalLink, Copy } from 'lucide-react'
import { HealthList } from './HealthList'

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
        <button className="settings-list-item danger">
          <div className="settings-list-item-content">
            <AlertOctagon size={18} />
            <span>{breached.title}</span>
          </div>
          <div className="settings-list-item-meta">
            <span>{breached.breach_count} breach{breached.breach_count !== 1 ? 'es' : ''}</span>
            <ArrowRight size={16} />
          </div>
        </button>
      )}
      renderExpandedContent={(breached, _index) => (
        <div className="settings-expandable-content">
          {breached.username && (
            <div className="settings-expandable-field">
              <span className="settings-expandable-label">Username:</span>
              <div className="settings-expandable-value-row">
                <span className="settings-expandable-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {breached.username}
                </span>
                <button
                  className="settings-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(breached.username)
                  }}
                  title="Copy username"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}

          <button
            className="settings-button settings-button-primary"
            style={{ width: '100%', marginTop: '12px' }}
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
            className="settings-button settings-button-ghost"
            style={{ width: '100%', marginTop: '8px' }}
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
