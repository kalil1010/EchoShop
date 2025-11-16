'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Bell,
  CheckCircle2,
  X,
  Package,
  DollarSign,
  MessageSquare,
  Shield,
  Settings,
  Loader2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'

interface Notification {
  id: string
  type: 'moderation' | 'order' | 'payout' | 'message' | 'system'
  title: string
  message: string
  link: string | null
  metadata: Record<string, unknown> | null
  is_read: boolean
  read_at: string | null
  created_at: string
  expires_at: string | null
}

const TYPE_ICONS = {
  moderation: Shield,
  order: Package,
  payout: DollarSign,
  message: MessageSquare,
  system: Settings,
}

const TYPE_COLORS = {
  moderation: 'text-blue-600 bg-blue-50 border-blue-200',
  order: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  payout: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  message: 'text-purple-600 bg-purple-50 border-purple-200',
  system: 'text-slate-600 bg-slate-50 border-slate-200',
}

export default function NotificationCenter() {
  const { userProfile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingRead, setMarkingRead] = useState<string | null>(null)

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/vendor/notifications', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load notifications')
      }

      const data = await response.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()

    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  const markAsRead = async (notificationId: string) => {
    if (markingRead === notificationId) return

    setMarkingRead(notificationId)
    try {
      const response = await fetch(`/api/vendor/notifications/${notificationId}/read`, {
        method: 'PATCH',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to mark as read')
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      toast({
        title: 'Failed to mark as read',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setMarkingRead(null)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/vendor/notifications/read-all', {
        method: 'PATCH',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to mark all as read')
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })),
      )
      setUnreadCount(0)

      toast({
        title: 'All notifications marked as read',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Failed to mark all as read',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      })
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      markAsRead(notification.id)
    }

    // Navigate to link if available
    if (notification.link) {
      router.push(notification.link)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const unreadNotifications = notifications.filter((n) => !n.is_read)

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-emerald-500 text-white text-xs font-medium rounded-full px-2 py-0.5">
                  {unreadCount}
                </span>
              )}
            </CardTitle>
            <CardDescription>Stay updated on your products, orders, and messages</CardDescription>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              Mark all as read
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type]
              const colorClass = TYPE_COLORS[notification.type]

              return (
                <div
                  key={notification.id}
                  className={`rounded-lg border p-4 transition-colors cursor-pointer ${
                    notification.is_read
                      ? 'bg-white border-slate-200'
                      : `${colorClass} border-l-4`
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 p-2 rounded-lg ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-slate-800">{notification.title}</h4>
                          <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
                          <p className="text-xs text-slate-400 mt-2">{formatDate(notification.created_at)}</p>
                        </div>
                        {!notification.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              markAsRead(notification.id)
                            }}
                            className="flex-shrink-0 p-1 hover:bg-slate-100 rounded transition-colors"
                            aria-label="Mark as read"
                          >
                            <CheckCircle2 className="h-4 w-4 text-slate-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

