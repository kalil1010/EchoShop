'use client'

import React, { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface VendorErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface VendorErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class VendorErrorBoundary extends Component<VendorErrorBoundaryProps, VendorErrorBoundaryState> {
  constructor(props: VendorErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): VendorErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[VendorErrorBoundary] Error caught:', error, errorInfo)
    
    // Log error to audit log
    if (typeof window !== 'undefined') {
      fetch('/api/event-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'vendor_error_boundary_triggered',
          payload: {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
          },
        }),
      }).catch((err) => console.warn('Failed to log error:', err))
    }

    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return <VendorErrorFallback error={this.state.error} onReset={this.handleReset} />
    }

    return this.props.children
  }
}

function VendorErrorFallback({
  error,
  onReset,
}: {
  error: Error | null
  onReset: () => void
}) {
  const router = useRouter()

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-amber-200 bg-amber-50/50">
        <CardHeader>
          <div className="flex items-center gap-3 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            An error occurred while loading the vendor dashboard. Your data is safe, and you can try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-amber-200 bg-white p-3">
              <p className="text-sm font-medium text-amber-900 mb-1">Error details:</p>
              <p className="text-xs text-amber-700">{error.message || 'An unexpected error occurred'}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={onReset} className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Try again
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/atlas')}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go to dashboard
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && error?.stack && (
            <details className="mt-4 rounded-lg border border-amber-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-medium text-amber-900">Stack trace</summary>
              <pre className="mt-2 text-[10px] whitespace-pre-wrap break-words text-amber-700">
                {error.stack}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

