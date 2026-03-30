import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-2xl ring-1 ring-red-200 p-8 text-center space-y-4">
            <div className="text-red-600 font-bold text-lg">Something went wrong</div>
            <p className="text-gray-500 text-sm">
              An unexpected error occurred. Please refresh the page. If the problem persists, contact your administrator.
            </p>
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
