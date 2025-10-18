/* eslint-disable @next/next/no-page-custom-font */
'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            <h1 className="text-lg font-semibold">Something went wrong</h1>
          </div>
          <p className="text-sm text-slate-600">
            We couldn&apos;t load this screen. Please try again, or return later if the issue persists.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
            {error?.digest && (
              <code className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                Ref: {error.digest.slice(0, 8)}
              </code>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
