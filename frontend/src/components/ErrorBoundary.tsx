import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '20px'
        }}>
          <AlertTriangle size={48} style={{ color: '#ef4444', marginBottom: '20px' }} />
          <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Something went wrong</h1>
          <p style={{ color: '#a1a1a1', marginBottom: '20px', textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
