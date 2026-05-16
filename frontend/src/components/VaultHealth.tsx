import { useState, useEffect } from 'react'
import { AlertTriangle, AlertOctagon, RefreshCw, ArrowRight, CheckCircle } from 'lucide-react'
import { api } from '../api/client'
import type { VaultHealthReport } from '../api/types'

interface VaultHealthProps {
  onWeakPasswords: () => void
  onReusedPasswords: () => void
  onBreachedCredentials: () => void
}

export default function VaultHealth({ onWeakPasswords, onReusedPasswords, onBreachedCredentials }: VaultHealthProps) {
  const [healthData, setHealthData] = useState<VaultHealthReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadVaultHealth()
  }, [])

  const loadVaultHealth = async () => {
    try {
      setIsLoading(true)
      const report = await api.checkVaultHealth()
      setHealthData(report)
    } catch (error) {
      console.error('Error loading vault health:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'var(--color-theme-accent)'
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
      <div className="px-5 py-5">
        <header className="flex items-baseline justify-between gap-3 flex-wrap pb-2.5 border-b border-theme-border mb-2">
          <h2 className="font-theme text-2xl font-semibold tracking-wide text-theme-accent">Vault Health</h2>
        </header>
        <div className="flex items-center justify-center py-10 px-4">
          <div className="w-6 h-6 border-2 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-theme-text font-theme">Analyzing passwords...</span>
        </div>
      </div>
    )
  }

  if (!healthData) {
    return (
      <div className="px-5 py-5">
        <header className="flex items-baseline justify-between gap-3 flex-wrap pb-2.5 border-b border-theme-border mb-2">
          <h2 className="font-theme text-2xl font-semibold tracking-wide text-theme-accent">Vault Health</h2>
        </header>
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-theme-text-secondary leading-relaxed">
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
    <div className="px-5 py-5">
      <header className="flex items-baseline justify-between gap-3 flex-wrap pb-2.5 border-b border-theme-border mb-2">
        <h2 className="font-theme text-2xl font-semibold tracking-wide text-theme-accent">Vault Health</h2>
        <div className="flex items-center gap-2.5">
          <span
            className="text-[11px] font-medium uppercase tracking-wider px-2 py-1"
            style={{
              backgroundColor: `${scoreColor}20`,
              color: scoreColor,
              border: `1px solid ${scoreColor}`
            }}
          >
            {healthData.overall_score}/100
          </span>
          <span className="font-theme text-[11px]" style={{ color: scoreColor, opacity: 0.9 }}>
            {getScoreLabel(healthData.overall_score)}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        {totalIssues > 0 ? (
          <p className="text-[13px] text-theme-text-secondary leading-relaxed">
            {totalIssues} password{totalIssues > 1 ? 's need' : ' needs'} attention.
          </p>
        ) : (
          <p className="text-[13px] text-theme-text-secondary leading-relaxed">
            All your passwords are secure!
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', margin: '12px 0' }}>
          <div className="flex items-center justify-between gap-3 p-3 bg-theme-surface border-2 border-theme-accent transition-transform duration-100 shadow-theme">
            <span className="text-[40px] leading-[1.0] font-semibold text-theme-text font-theme">{healthData.total_entries}</span>
            <span className="text-xs text-theme-text-secondary uppercase tracking-wider">Total</span>
          </div>
          <div className="flex items-center justify-between gap-3 p-3 bg-theme-surface border-2 border-theme-accent transition-transform duration-100 shadow-theme">
            <span className="text-[40px] leading-[1.0] font-semibold text-theme-accent font-theme">{healthData.strong_passwords}</span>
            <span className="text-xs text-theme-text-secondary uppercase tracking-wider">Strong</span>
          </div>
          <div className="flex items-center justify-between gap-3 p-3 bg-theme-surface border-2 border-theme-accent transition-transform duration-100 shadow-theme">
            <span className="text-[40px] leading-[1.0] font-semibold text-theme-text font-theme">{Math.round(healthData.average_entropy)}</span>
            <span className="text-xs text-theme-text-secondary uppercase tracking-wider">Avg Bits</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 my-3">
          {weakCount > 0 && (
            <button onClick={onWeakPasswords} className="flex items-center justify-between gap-4 px-4 py-3 bg-theme-danger border-2 border-theme-accent cursor-pointer transition-transform duration-100 shadow-theme hover:bg-theme-danger hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm">
              <div className="flex items-center gap-3 text-theme-text font-extrabold min-w-0 flex-1">
                <AlertTriangle size={18} />
                <span>Weak Passwords</span>
              </div>
              <div className="flex items-center gap-2 text-theme-text-secondary text-sm">
                <span>{weakCount}</span>
                <ArrowRight size={16} />
              </div>
            </button>
          )}

          {reusedCount > 0 && (
            <button onClick={onReusedPasswords} className="flex items-center justify-between gap-4 px-4 py-3 bg-theme-surface-hover border-2 border-theme-accent cursor-pointer transition-transform duration-100 shadow-theme hover:bg-theme-surface-hover hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm">
              <div className="flex items-center gap-3 text-theme-accent font-extrabold min-w-0 flex-1">
                <AlertTriangle size={18} />
                <span>Reused Passwords</span>
              </div>
              <div className="flex items-center gap-2 text-theme-text-secondary text-sm">
                <span>{reusedCount}</span>
                <ArrowRight size={16} />
              </div>
            </button>
          )}

          {breachedCount > 0 && (
            <button onClick={onBreachedCredentials} className="flex items-center justify-between gap-4 px-4 py-3 bg-theme-danger border-2 border-theme-accent cursor-pointer transition-transform duration-100 shadow-theme hover:bg-theme-danger hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm">
              <div className="flex items-center gap-3 text-theme-text font-extrabold min-w-0 flex-1">
                <AlertOctagon size={18} />
                <span>Breached Credentials</span>
              </div>
              <div className="flex items-center gap-2 text-theme-text-secondary text-sm">
                <span>{breachedCount}</span>
                <ArrowRight size={16} />
              </div>
            </button>
          )}

          {totalIssues === 0 && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 bg-theme-success border-2 border-theme-accent shadow-theme">
              <div className="flex items-center gap-3 text-theme-success font-extrabold min-w-0 flex-1">
                <CheckCircle size={18} />
                <span>No issues found</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={loadVaultHealth} className="px-5 py-2.5 bg-theme-bg text-theme-text border-2 border-theme-accent font-extrabold font-theme uppercase tracking-wider cursor-pointer transition-transform duration-100 hover:bg-theme-surface hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none flex items-center gap-2">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}



