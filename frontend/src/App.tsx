import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface Entry {
  id: string
  title: string
  username: string
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<Entry[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    
    if (query.length < 2) {
      setResults([])
      return
    }

    try {
      const result = await invoke('search_entries', { query })
      const entries = JSON.parse(result as string)
      setResults(entries)
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    }
  }

  const handleCopyPassword = async (entryId: string) => {
    try {
      await invoke('request_secret', { entryId, field: 'password' })
      console.log('Password copied for:', entryId)
    } catch (error) {
      console.error('Failed to copy password:', error)
    }
  }

  return (
    <div className="container">
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
