import { useState, useEffect, useCallback, ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import { api } from '../../api/client'

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
      const report = await api.checkVaultHealth()
      setData((report[fetchKey] as T[]) || [])
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
      <div className="px-5 py-5">
        <header className="flex items-baseline justify-between gap-3 flex-wrap pb-2.5 border-b border-theme-border mb-2">
          <h2 className="font-theme text-2xl font-semibold tracking-wide text-theme-accent">{title}</h2>
        </header>
        <div className="flex items-center justify-center py-10 px-4">
          <div className="w-6 h-6 border-2 border-theme-accent border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-theme-text font-theme">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 py-5">
      <header className="flex items-baseline justify-between gap-3 flex-wrap pb-2.5 border-b border-theme-border mb-2">
        <h2 className="font-theme text-2xl font-semibold tracking-wide text-theme-accent">{title}</h2>
        <div className="flex items-center gap-2.5">
          <span
            className="text-[11px] font-medium uppercase tracking-wider px-2 py-1"
            style={{
              backgroundColor: badgeBgColor,
              color: badgeColor,
              border: `1px solid ${badgeColor}`
            }}
          >
            {renderBadge(data.length)}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-theme-text-secondary leading-relaxed">{instruction}</p>

        {data.length === 0 ? (
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-theme-success border-2 border-theme-accent shadow-theme cursor-default">
            <div className="flex items-center gap-3 text-theme-success font-extrabold min-w-0 flex-1">
              <span>{emptyMessage}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 my-3">
            {data.map((item, index) => (
              <div key={index} className="flex flex-col">
                <div onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}>
                  {renderItem(item, index)}
                </div>
                {expandedIndex === index && (
                  <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                    <div className="p-5 bg-theme-bg border-2 border-theme-accent border-t-0 shadow-theme-inset">
                      {renderExpandedContent(item, index)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={loadData} className="px-5 py-2.5 bg-theme-bg text-theme-text border-2 border-theme-accent font-extrabold font-theme uppercase tracking-wider cursor-pointer transition-transform duration-100 hover:bg-theme-surface hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-theme-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none flex items-center gap-2">
            <RotateCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}



