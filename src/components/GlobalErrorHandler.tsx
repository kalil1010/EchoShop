'use client'

import { useEffect } from 'react'

export function GlobalErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorCode = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code)
        : ''

      // Suppress refresh token errors - these are expected when tokens expire
      const isRefreshTokenError =
        errorMessage.includes('Refresh Token') ||
        errorMessage.includes('refresh_token_not_found') ||
        errorCode === 'refresh_token_not_found' ||
        (error && typeof error === 'object' && '__isAuthError' in error && errorCode === 'refresh_token_not_found')

      if (isRefreshTokenError) {
        // Prevent the error from appearing in console
        event.preventDefault()
        // Log at debug level only
        console.debug('[GlobalErrorHandler] Suppressed refresh token error (expected when tokens expire)')
        return
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}

