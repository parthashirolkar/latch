import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { z } from 'zod'

const EntryPreviewSchema = z.object({
    id: z.string(),
    title: z.string(),
    username: z.string(),
    icon_url: z.string().optional()
})

const EntriesSchema = z.array(EntryPreviewSchema)

export interface Entry {
    id: string
    title: string
    username: string
    icon_url?: string
}

export function useSearch(setModeToLogin: () => void) {
    const [searchResults, setSearchResults] = useState<Entry[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const handleSearch = useCallback(async (query: string) => {
        if (query.length < 2) {
            setSearchResults([])
            setIsLoading(false)
            return
        }

        try {
            setIsLoading(true)
            const result = await invoke('search_entries', { query })
            const entries = EntriesSchema.parse(JSON.parse(result as string))
            setSearchResults(entries)
        } catch (error) {
            const err = error as { message: string }
            if (err?.message?.includes('locked')) {
                setModeToLogin()
            }
            console.error('Search failed:', error)
            setSearchResults([])
        } finally {
            setIsLoading(false)
        }
    }, [setModeToLogin])

    return { searchResults, setSearchResults, isLoading, handleSearch }
}
