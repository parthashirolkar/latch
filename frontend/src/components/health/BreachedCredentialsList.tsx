import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AlertOctagon, ArrowRight, RotateCw, ExternalLink, Copy } from 'lucide-react'

interface BreachedCredential {
  entry_id: string
  title: string
  username: string
  breach_count: number
}

interface VaultHealthResponse {
  status: string
  report: {
    breached_credentials: BreachedCredential[]
  }
}

interface BreachedCredentialsListProps {
  onSelectEntry: (entryId: string) => void
}

export default function BreachedCredentialsList({ onSelectEntry }: BreachedCredentialsListProps) {
  const [breachedCredentials, setBreachedCredentials] = useState<BreachedCredential[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadBreachedCredentials()
  }, [])

  const loadBreachedCredentials = async () => {
    try {
      setIsLoading(true)
      const result = await invoke('check_vault_health')
      const data = JSON.parse(result as string) as VaultHealthResponse
      setBreachedCredentials(data.report?.breached_credentials || [])
    } catch (error) {
      console.error('Error loading breached credentials:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="settings-container">
        <header className="settings-header">
          <h2>Breached Credentials</h2>
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
        <h2>Breached Credentials</h2>
        <div className="settings-header-meta">
          <span 
            className="settings-current-badge"
            style={{ 
              backgroundColor: '#ff4d4d20',
              color: '#ff4d4d',
              borderColor: '#ff4d4d'
            }}
          >
            {breachedCredentials.length}
          </span>
        </div>
      </header>

      <div className="settings-body">
        {breachedCredentials.length > 0 ? (
          <>
            <p className="settings-instruction">
              These passwords have appeared in known data breaches. Update them immediately to secure your accounts.
            </p>

            <div className="settings-list">
              {breachedCredentials.map((breached) => (
                <div key={breached.entry_id} className="settings-expandable-item">
                  <button 
                    className="settings-list-item danger"
                    onClick={() => setExpandedId(expandedId === breached.entry_id ? null : breached.entry_id)}
                  >
                    <div className="settings-list-item-content">
                      <AlertOctagon size={18} />
                      <span>{breached.title}</span>
                    </div>
                    <div className="settings-list-item-meta">
                      <span>{breached.breach_count} breach{breached.breach_count !== 1 ? 'es' : ''}</span>
                      <ArrowRight size={16} />
                    </div>
                  </button>

                  {expandedId === breached.entry_id && (
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="settings-list-item success">
            <div className="settings-list-item-content">
              <span>No breached credentials found!</span>
            </div>
          </div>
        )}

        <div className="settings-actions" style={{ marginTop: '16px' }}>
          <button className="settings-button settings-button-ghost" onClick={loadBreachedCredentials}>
            <RotateCw size={16} />
            Refresh
          </button>
          <a 
            href="https://haveibeenpwned.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="settings-button settings-button-ghost"
          >
            <ExternalLink size={16} />
            Learn More
          </a>
        </div>
      </div>
    </div>
  )
}
