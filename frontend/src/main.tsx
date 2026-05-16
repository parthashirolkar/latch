import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Apply saved theme immediately to prevent FOUC
const savedTheme = localStorage.getItem('latch-theme')
const themeMap: Record<string, string> = {
  brutalist: 'dark-focus',
  'print-editorial': 'clean-light',
  terminal: 'accessible'
}
const activeTheme = themeMap[savedTheme || ''] || savedTheme || 'dark-focus'
document.documentElement.setAttribute('data-theme', activeTheme)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)


