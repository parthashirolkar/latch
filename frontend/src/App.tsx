import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import SetupVault from './components/SetupVault'
import UnlockVault from './components/UnlockVault'
import LockButton from './components/LockButton'

interface Entry {
  id: string
  title: string
  username: string
}

interface VaultStatus {
  status: string
  has_vault: boolean
  is_unlocked: boolean
}

function App() {
  const [hasVault, setHasVault] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkVaultStatus()
  }, [])

  const checkVaultStatus = async () => {
    setLoading(true)
    try {
      const result = await invoke('vault_status')
      const status = JSON.parse(result as string) as VaultStatus
      setHasVault(status.has_vault)
      setIsUnlocked(status.is_unlocked)
    } catch (error) {
      console.error('Failed to check vault status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUnlockSuccess = () => {
    setIsUnlocked(true)
  }

  const handleLock = () => {
    setIsUnlocked(false)
    setSearchQuery('')
    setResults([])
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)

    if (query.length < 2) {
      setResults([])
      return
    }

    try {
      const result = await invoke('search_entries', { query })
      const entries = JSON.parse(result as string)

      if (Array.isArray(entries)) {
        setResults(entries)
      } else if (entries.status === 'error') {
        console.error('Search failed:', entries.message)
        setIsUnlocked(false)
      }
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    }
  }

  const handleCopyPassword = async (entryId: string) => {
    try {
      const result = await invoke('request_secret', { entryId, field: 'password' })
      const response = JSON.parse(result as string)

      if (response.status === 'success') {
        console.log('Password copied for:', entryId)
      } else if (response.status === 'error') {
        console.error('Failed to copy password:', response.message)
        if (response.message.includes('locked')) {
          setIsUnlocked(false)
        }
      }
    } catch (error) {
      console.error('Failed to copy password:', error)
    }
  }

  if (loading) {
    return <div className="container">Loading...</div>
  }

  if (!hasVault) {
    return <SetupVault onSuccess={checkVaultStatus} />
  }

  if (!isUnlocked) {
    return <UnlockVault onSuccess={handleUnlockSuccess} />
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Latch</h1>
        <LockButton onLock={handleLock} />
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search passwords... (Cmd+K)"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="search-input"
          autoFocus
        />
      </div>

      {results.length > 0 && (
        <ul className="results-list">
          {results.map((result) => (
            <li key={result.id} className="result-item">
              <div className="result-info">
                <div className="result-title">{result.title}</div>
                <div className="result-username">{result.username}</div>
              </div>
              <button
                className="copy-button"
                onClick={() => handleCopyPassword(result.id)}
              >
                Copy
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App
