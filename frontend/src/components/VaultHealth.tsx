import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AlertTriangle, AlertOctagon, RefreshCw, ArrowRight, CheckCircle } from 'lucide-react'

interface VaultHealthData {
  overall_score: number
  weak_passwords: Array<{ id: string; title: string }>
  reused_passwords: Array<{ id: string; title: string }>
  breached_credentials: Array<{ id: string; title: string }>
  total_entries: number
  strong_passwords: number
  average_entropy: number
}

interface VaultHealthResponse {
  status: string
  report: VaultHealthData
}

interface VaultHealthProps {
  onWeakPasswords: () => void
  onReusedPasswords: () => void
  onBreachedCredentials: () => void
}

export default function VaultHealth({ onWeakPasswords, onReusedPasswords, onBreachedCredentials }: VaultHealthProps) {
  const [healthData, setHealthData] = useState<VaultHealthData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadVaultHealth()
  }, [])

  const loadVaultHealth = async () => {
    try {
      setIsLoading(true)
      const result = await invoke('check_vault_health')
      const response = JSON.parse(result as string) as VaultHealthResponse
      if (response.status === 'success' && response.report) {
        setHealthData(response.report)
      }
    } catch (error) {
      console.error('Error loading vault health:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'var(--accent-primary)'
    if (score >= 80) return '#90ee90'
    if (score >= 60) return '#ffcc00'
    if (score >= 40) return '#ffa500'
    return '#ff4d4d'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Good'
    if (score >= 60) return 'Fair'
    if (score >= 40) return 'Poor'
    return 'Critical'
  }

  if (isLoading) {
    return (
      <div className="settings-container">
        <header className="settings-header">
          <h2>Vault Health</h2>
        </header>
        <div className="settings-loading">
          <div className="settings-loading-spinner"></div>
          <span style={{ marginLeft: '12px' }}>Analyzing passwords...</span>
        </div>
      </div>
    )
  }

  if (!healthData) {
    return (
      <div className="settings-container">
        <header className="settings-header">
          <h2>Vault Health</h2>
        </header>
        <div className="settings-body">
          <div className="settings-instruction" style={{ color: 'var(--text-secondary)' }}>
            Unable to load vault health data.
          </div>
        </div>
      </div>
    )
  }

  const weakCount = healthData.weak_passwords?.length || 0
  const reusedCount = healthData.reused_passwords?.length || 0
  const breachedCount = healthData.breached_credentials?.length || 0
  const totalIssues = weakCount + reusedCount + breachedCount
  const scoreColor = getScoreColor(healthData.overall_score)

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h2>Vault Health</h2>
        <div className="settings-header-meta">
          <span 
            className="settings-current-badge"
            style={{ 
              backgroundColor: `${scoreColor}20`,
              color: scoreColor,
              borderColor: scoreColor
            }}
          >
            {healthData.overall_score}/100
          </span>
          <span 
            className="settings-session-timer"
            style={{ color: scoreColor }}
          >
            {getScoreLabel(healthData.overall_score)}
          </span>
        </div>
      </header>

      <div className="settings-body">
        {totalIssues > 0 ? (
          <p className="settings-instruction">
            {totalIssues} password{totalIssues > 1 ? 's need' : ' needs'} attention.
          </p>
        ) : (
          <p className="settings-instruction">
            All your passwords are secure!
          </p>
        )}

        <div className="settings-stats-grid">
          <div className="settings-stat-item">
            <span className="settings-stat-value">{healthData.total_entries}</span>
            <span className="settings-stat-label">Total</span>
          </div>
          <div className="settings-stat-item">
            <span className="settings-stat-value" style={{ color: 'var(--accent-primary)' }}>{healthData.strong_passwords}</span>
            <span className="settings-stat-label">Strong</span>
          </div>
          <div className="settings-stat-item">
            <span className="settings-stat-value">{Math.round(healthData.average_entropy)}</span>
            <span className="settings-stat-label">Avg Bits</span>
          </div>
        </div>

        <div className="settings-list">
          {weakCount > 0 && (
            <button className="settings-list-item danger" onClick={onWeakPasswords}>
              <div className="settings-list-item-content">
                <AlertTriangle size={18} />
                <span>Weak Passwords</span>
              </div>
              <div className="settings-list-item-meta">
                <span>{weakCount}</span>
                <ArrowRight size={16} />
              </div>
            </button>
          )}

          {reusedCount > 0 && (
            <button className="settings-list-item warning" onClick={onReusedPasswords}>
              <div className="settings-list-item-content">
                <AlertTriangle size={18} />
                <span>Reused Passwords</span>
              </div>
              <div className="settings-list-item-meta">
                <span>{reusedCount}</span>
                <ArrowRight size={16} />
              </div>
            </button>
          )}

          {breachedCount > 0 && (
            <button className="settings-list-item danger" onClick={onBreachedCredentials}>
              <div className="settings-list-item-content">
                <AlertOctagon size={18} />
                <span>Breached Credentials</span>
              </div>
              <div className="settings-list-item-meta">
                <span>{breachedCount}</span>
                <ArrowRight size={16} />
              </div>
            </button>
          )}

          {totalIssues === 0 && (
            <div className="settings-list-item success">
              <div className="settings-list-item-content">
                <CheckCircle size={18} />
                <span>No issues found</span>
              </div>
            </div>
          )}
        </div>

        <div className="settings-actions">
          <button className="settings-button settings-button-ghost" onClick={loadVaultHealth}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
