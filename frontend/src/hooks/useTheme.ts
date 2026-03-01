import { useState, useEffect } from 'react'


export type ThemeId = 'brutalist' | 'win98' | 'print-editorial' | 'terminal'

export const THEMES: { id: ThemeId; name: string; primary: string; bg: string }[] = [
    { id: 'brutalist', name: 'Brutalist', primary: '#FF3B00', bg: '#111111' },
    { id: 'win98', name: 'Windows 98', primary: '#000080', bg: '#008080' },
    { id: 'print-editorial', name: 'Editorial', primary: '#DF2020', bg: '#F4F4F0' },
    { id: 'terminal', name: 'Terminal', primary: '#00FF41', bg: '#000000' }
]

export function useTheme() {
    const [theme, setThemeState] = useState<ThemeId>(() => {
        const saved = localStorage.getItem('latch-theme') as ThemeId | null
        return saved && THEMES.some((t) => t.id === saved) ? saved : 'brutalist'
    })

    // Apply theme to document when it changes
    useEffect(() => {
        if (theme === 'brutalist') {
            document.documentElement.removeAttribute('data-theme')
        } else {
            document.documentElement.setAttribute('data-theme', theme)
        }
        localStorage.setItem('latch-theme', theme)
    }, [theme])

    // Sync across windows (e.g. if we add multiple windows later)
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'latch-theme' && e.newValue) {
                if (THEMES.some((t) => t.id === e.newValue)) {
                    setThemeState(e.newValue as ThemeId)
                }
            }
        }
        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [])

    const setTheme = (newTheme: ThemeId) => {
        setThemeState(newTheme)
    }

    return { theme, setTheme }
}
