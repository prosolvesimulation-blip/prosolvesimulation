import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
    hasError: boolean
    error?: Error
    errorInfo?: ErrorInfo
}

export default class ModelConfigErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ModelConfig Error Boundary caught an error:', error, errorInfo)
        this.setState({ errorInfo })
        
        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined })
    }

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback
            }

            // Default error UI
            return (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-xl font-semibold text-white mb-2">
                        Configuration Error
                    </h2>
                    <p className="text-slate-400 mb-6 max-w-md">
                        Something went wrong while loading the mesh configuration. 
                        Please try refreshing the page or contact support if the problem persists.
                    </p>
                    
                    <div className="space-y-3">
                        <button
                            onClick={this.handleReset}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            Try Again
                        </button>
                        
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="text-left">
                                <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-400">
                                    Error Details (Development)
                                </summary>
                                <div className="mt-2 p-3 bg-slate-800 rounded text-xs text-slate-300 font-mono overflow-auto max-h-40">
                                    <div className="text-red-400 mb-2">{this.state.error.message}</div>
                                    <div className="text-slate-400">{this.state.error.stack}</div>
                                    {this.state.errorInfo && (
                                        <div className="mt-2 text-slate-400">
                                            <div className="text-slate-500">Component Stack:</div>
                                            {this.state.errorInfo.componentStack}
                                        </div>
                                    )}
                                </div>
                            </details>
                        )}
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
