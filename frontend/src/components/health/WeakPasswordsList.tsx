import { AlertTriangle, ArrowRight, Copy } from 'lucide-react'
import { HealthList } from './HealthList'

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
        <button className="settings-list-item danger">
          <div className="settings-list-item-content">
            <AlertTriangle size={18} />
            <span>{weak.title}</span>
          </div>
          <div className="settings-list-item-meta">
            <span>{getStrengthLabel(weak.score)}</span>
            <ArrowRight size={16} />
          </div>
        </button>
      )}
      renderExpandedContent={(weak, _index) => (
        <div className="settings-expandable-content">
          {weak.username && (
            <div className="settings-expandable-field">
              <span className="settings-expandable-label">Username:</span>
              <div className="settings-expandable-value-row">
                <span className="settings-expandable-value" style={{ fontFamily: 'var(--font-mono)' }}>
                  {weak.username}
                </span>
                <button
                  className="settings-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(weak.username)
                  }}
                  title="Copy username"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="settings-expandable-field">
            <span className="settings-expandable-label">Strength:</span>
            <div style={{ marginTop: '4px', color: '#ff4d4d', fontSize: 'var(--font-sm)' }}>
              {weak.label} ({Math.round(weak.entropy)} bits)
            </div>
          </div>

          <button
            className="settings-button settings-button-primary"
            style={{ width: '100%', marginTop: '12px' }}
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
