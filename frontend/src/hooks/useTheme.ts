import { useState, useEffect } from 'react'

export type ThemeId = 'dark-focus' | 'clean-light' | 'win98' | 'accessible'

export const THEMES: { id: ThemeId; name: string; primary: string; bg: string }[] = [
    { id: 'dark-focus', name: 'Dark Focus', primary: 'oklch(0.65 0.10 150)', bg: 'oklch(0.18 0.01 260)' },
    { id: 'clean-light', name: 'Clean Light', primary: 'oklch(0.50 0.14 255)', bg: 'oklch(0.97 0.005 80)' },
    { id: 'win98', name: 'Win98', primary: '#000080', bg: '#008080' },
    { id: 'accessible', name: 'High Contrast', primary: '#00FFFF', bg: '#000000' }
]

export function useTheme() {
    const [theme, setThemeState] = useState<ThemeId>(() => {
        const saved = localStorage.getItem('latch-theme')
        // Migrate old theme names to new ones
        if (saved === 'brutalist') return 'dark-focus'
        if (saved === 'print-editorial') return 'clean-light'
        if (saved === 'terminal') return 'accessible'
        return saved && THEMES.some((t) => t.id === saved) ? (saved as ThemeId) : 'dark-focus'
    })

    // Apply theme to document when it changes
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
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


