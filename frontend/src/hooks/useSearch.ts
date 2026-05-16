import { useState, useCallback } from 'react'
import { api } from '../api/client'
import { type CredentialPreview } from '../api/types'

export type { CredentialPreview as Entry } from '../api/types'

export function useSearch() {
  const [searchResults, setSearchResults] = useState<CredentialPreview[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const entries = await api.searchEntries(query)
      setSearchResults(entries)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { searchResults, setSearchResults, isLoading, handleSearch }
}


