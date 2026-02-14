import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AlertTriangle, ArrowRight, RotateCw, Copy } from 'lucide-react'

interface WeakPassword {
  entry_id: string
  title: string
  username: string
  score: number
  entropy: number
  label: string
}

interface VaultHealthResponse {
  status: string
  report: {
    weak_passwords: WeakPassword[]
  }
}

interface WeakPasswordsListProps {
  onSelectEntry: (entryId: string) => void
}

export default function WeakPasswordsList({ onSelectEntry }: WeakPasswordsListProps) {
  const [weakPasswords, setWeakPasswords] = useState<WeakPassword[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadWeakPasswords()
  }, [])

  const loadWeakPasswords = async () => {
    try {
      setIsLoading(true)
      const result = await invoke('check_vault_health')
      const data = JSON.parse(result as string) as VaultHealthResponse
      setWeakPasswords(data.report?.weak_passwords || [])
    } catch (error) {
      console.error('Error loading weak passwords:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStrengthLabel = (score: number) => {
    if (score >= 4) return 'Very Strong'
    if (score >= 3) return 'Strong'
    if (score >= 2) return 'Fair'
    if (score >= 1) return 'Weak'
    return 'Very Weak'
  }

  if (isLoading) {
    return (
      <div className="settings-container">
        <header className="settings-header">
          <h2>Weak Passwords</h2>
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
        <h2>Weak Passwords</h2>
        <div className="settings-header-meta">
          <span 
            className="settings-current-badge"
            style={{ 
              backgroundColor: '#ff4d4d20',
              color: '#ff4d4d',
              borderColor: '#ff4d4d'
            }}
          >
            {weakPasswords.length}
          </span>
        </div>
      </header>

      <div className="settings-body">
        <p className="settings-instruction">
          These passwords are weak or easy to guess. Consider updating them with stronger alternatives.
        </p>

        {weakPasswords.length === 0 ? (
          <div className="settings-list-item success">
            <div className="settings-list-item-content">
              <span>No weak passwords found!</span>
            </div>
          </div>
        ) : (
          <div className="settings-list">
            {weakPasswords.map((weak) => (
              <div key={weak.entry_id} className="settings-expandable-item">
                <button 
                  className="settings-list-item danger"
                  onClick={() => setExpandedId(expandedId === weak.entry_id ? null : weak.entry_id)}
                >
                  <div className="settings-list-item-content">
                    <AlertTriangle size={18} />
                    <span>{weak.title}</span>
                  </div>
                  <div className="settings-list-item-meta">
                    <span>{getStrengthLabel(weak.score)}</span>
                    <ArrowRight size={16} />
                  </div>
                </button>

                {expandedId === weak.entry_id && (
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
              </div>
            ))}
          </div>
        )}

        <div className="settings-actions">
          <button className="settings-button settings-button-ghost" onClick={loadWeakPasswords}>
            <RotateCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
