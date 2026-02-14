import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AlertTriangle, ArrowRight, RotateCw, Copy, ExternalLink } from 'lucide-react'

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

interface VaultHealthResponse {
  status: string
  report: {
    reused_passwords: ReusedPassword[]
  }
}

interface ReusedPasswordsListProps {
  onSelectEntry: (entryId: string) => void
}

export default function ReusedPasswordsList({ onSelectEntry }: ReusedPasswordsListProps) {
  const [reusedPasswords, setReusedPasswords] = useState<ReusedPassword[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    loadReusedPasswords()
  }, [])

  const loadReusedPasswords = async () => {
    try {
      setIsLoading(true)
      const result = await invoke('check_vault_health')
      const data = JSON.parse(result as string) as VaultHealthResponse
      setReusedPasswords(data.report?.reused_passwords || [])
    } catch (error) {
      console.error('Error loading reused passwords:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="settings-container">
        <header className="settings-header">
          <h2>Reused Passwords</h2>
        </header>
        <div className="settings-loading">
          <div className="settings-loading-spinner"></div>
          <span style={{ marginLeft: '12px' }}>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h2>Reused Passwords</h2>
        <div className="settings-header-meta">
          <span 
            className="settings-current-badge"
            style={{ 
              backgroundColor: '#ffa50020',
              color: '#ffa500',
              borderColor: '#ffa500'
            }}
          >
            {reusedPasswords.length} set{reusedPasswords.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      <div className="settings-body">
        <p className="settings-instruction">
          These passwords are used on multiple accounts. Consider using unique passwords for each site.
        </p>

        {reusedPasswords.length === 0 ? (
          <div className="settings-list-item success">
            <div className="settings-list-item-content">
              <span>No reused passwords found!</span>
            </div>
          </div>
        ) : (
          <div className="settings-list">
            {reusedPasswords.map((reused, index) => (
              <div key={index} className="settings-expandable-item">
                <button 
                  className="settings-list-item warning"
                  onClick={() => setExpandedId(expandedId === index ? null : index)}
                >
                  <div className="settings-list-item-content">
                    <AlertTriangle size={18} />
                    <span>Password used {reused.count} times</span>
                  </div>
                  <div className="settings-list-item-meta">
                    <span>{reused.entries.length} accounts</span>
                    <ArrowRight size={16} />
                  </div>
                </button>

                {expandedId === index && (
                  <div className="settings-expandable-content">
                    <div className="settings-expandable-field">
                      <span className="settings-expandable-label">Password:</span>
                      <div className="settings-expandable-value-row">
                        <code className="settings-expandable-value">{reused.password}</code>
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
              </div>
            ))}
          </div>
        )}

        <div className="settings-actions">
          <button className="settings-button settings-button-ghost" onClick={loadReusedPasswords}>
            <RotateCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
