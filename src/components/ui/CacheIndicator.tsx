'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'

interface CacheIndicatorProps {
  show?: boolean
  message?: string
  duration?: number
}

/**
 * CacheIndicator - Shows when content is loaded from cache
 * 
 * Displays a subtle notification when content is restored from cache
 * during page refresh or session restoration. Helps users understand
 * why content loads instantly.
 */
export function CacheIndicator({ 
  show = false, 
  message = 'Content restored from cache',
  duration = 3000 
}: CacheIndicatorProps) {
  const [visible, setVisible] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    if (show) {
      setVisible(true)
      setFadeOut(false)

      // Start fade out animation before hiding
      const fadeOutTimer = setTimeout(() => {
        setFadeOut(true)
      }, duration - 300)

      // Hide completely after animation
      const hideTimer = setTimeout(() => {
        setVisible(false)
        setFadeOut(false)
      }, duration)

      return () => {
        clearTimeout(fadeOutTimer)
        clearTimeout(hideTimer)
      }
    }
  }, [show, duration])

  if (!visible) return null

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-900 shadow-lg border border-blue-200 transition-opacity duration-300 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      role="status"
      aria-live="polite"
    >
      <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
      <span>{message}</span>
      <Wifi className="h-4 w-4 text-green-600" />
    </div>
  )
}

/**
 * OfflineIndicator - Shows when user is offline
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [showMessage, setShowMessage] = useState(false)

  useEffect(() => {
    // Check initial status
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setShowMessage(true)
      setTimeout(() => setShowMessage(false), 3000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowMessage(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!showMessage) return null

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-lg border transition-all duration-300 ${
        isOnline
          ? 'bg-green-50 text-green-900 border-green-200'
          : 'bg-orange-50 text-orange-900 border-orange-200'
      }`}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4 text-green-600" />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-orange-600" />
          <span>You're offline - using cached data</span>
        </>
      )}
    </div>
  )
}

