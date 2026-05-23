import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary caught]', error, info.componentStack)
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div style={{
                    padding: '40px',
                    background: '#fff',
                    border: '1px solid #fca5a5',
                    borderRadius: '8px',
                    margin: '20px',
                    fontFamily: 'monospace'
                }}>
                    <h2 style={{ color: '#dc2626', fontSize: '16px', marginBottom: '12px' }}>
                        Erreur de rendu — {this.state.error?.name}
                    </h2>
                    <pre style={{
                        fontSize: '12px',
                        color: '#374151',
                        whiteSpace: 'pre-wrap',
                        background: '#f9fafb',
                        padding: '12px',
                        borderRadius: '4px'
                    }}>
                        {this.state.error?.message}
                    </pre>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            marginTop: '12px',
                            padding: '6px 14px',
                            background: '#1D9E75',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Réessayer
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

export default ErrorBoundary
