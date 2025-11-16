'use client'

import React, { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

interface NotificationBellProps {
  className?: string
}

export default function NotificationBell({ className }: NotificationBellProps) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const response = await fetch('/api/vendor/notifications?unreadOnly=true&limit=1', {
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          setUnreadCount(data.unreadCount || 0)
        }
      } catch (error) {
        console.error('Failed to load unread count:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUnreadCount()

    // Poll for updates every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return null
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push('/atlas?tab=overview')}
      className={`relative ${className || ''}`}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs font-medium rounded-full h-5 w-5 flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  )
}

