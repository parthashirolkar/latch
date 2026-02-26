import { useState, useEffect, useCallback, ReactNode } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { RotateCw } from 'lucide-react'

interface HealthListProps<T> {
  title: string
  fetchKey: 'weak_passwords' | 'reused_passwords' | 'breached_credentials'
  emptyMessage: string
  instruction: string
  badgeColor: string
  badgeBgColor: string
  renderBadge: (count: number) => ReactNode
  renderItem: (item: T, index: number) => ReactNode
  renderExpandedContent: (item: T, index: number) => ReactNode
}

export function HealthList<T>({
  title,
  fetchKey,
  emptyMessage,
  instruction,
  badgeColor,
  badgeBgColor,
  renderBadge,
  renderItem,
  renderExpandedContent,
}: HealthListProps<T>) {
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const result = await invoke('check_vault_health')
      const parsed = JSON.parse(result as string)
      setData((parsed.report?.[fetchKey] as T[]) || [])
    } catch (error) {
      console.error(`Error loading ${fetchKey}:`, error)
    } finally {
      setIsLoading(false)
    }
  }, [fetchKey])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (isLoading) {
    return (
      <div className="settings-container">
        <header className="settings-header">
          <h2>{title}</h2>
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
        <h2>{title}</h2>
        <div className="settings-header-meta">
          <span
            className="settings-current-badge"
            style={{
              backgroundColor: badgeBgColor,
              color: badgeColor,
              borderColor: badgeColor,
            }}
          >
            {renderBadge(data.length)}
          </span>
        </div>
      </header>

      <div className="settings-body">
        <p className="settings-instruction">{instruction}</p>

        {data.length === 0 ? (
          <div className="settings-list-item success">
            <div className="settings-list-item-content">
              <span>{emptyMessage}</span>
            </div>
          </div>
        ) : (
          <div className="settings-list">
            {data.map((item, index) => (
              <div key={index} className="settings-expandable-item">
                <div onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}>
                  {renderItem(item, index)}
                </div>
                {expandedIndex === index && (
                  <div onClick={(e) => e.stopPropagation()}>
                    {renderExpandedContent(item, index)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="settings-actions">
          <button className="settings-button settings-button-ghost" onClick={loadData}>
            <RotateCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
