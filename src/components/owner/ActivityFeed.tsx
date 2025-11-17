'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ActivityFilters } from './ActivityFilters'
import { supabase } from '@/lib/supabase'
import { Clock, Package, ShoppingCart, User, DollarSign, MoreHorizontal } from 'lucide-react'

interface ActivityLog {
  id: string
  vendor_id: string
  action_type: string
  action_category: string
  description: string
  related_entity_type: string | null
  related_entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  vendor_name?: string
  vendor_email?: string
}

interface ActivityStats {
  total_activities: number
  by_category: Record<string, number>
  by_type: Record<string, number>
  recent_activity_count: number
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    vendorId: '',
    actionCategory: '',
    actionType: '',
    startDate: '',
    endDate: '',
  })
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.vendorId) params.set('vendor_id', filters.vendorId)
      if (filters.actionCategory) params.set('category', filters.actionCategory)
      if (filters.actionType) params.set('type', filters.actionType)
      if (filters.startDate) params.set('start_date', filters.startDate)
      if (filters.endDate) params.set('end_date', filters.endDate)
      params.set('page', page.toString())
      params.set('limit', '50')

      const response = await fetch(`/api/admin/activity-feed?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load activities')
      }

      const data = await response.json()
      if (page === 1) {
        setActivities(data.activities || [])
      } else {
        setActivities((prev) => [...prev, ...(data.activities || [])])
      }
      setHasMore(data.has_more || false)
      setStats(data.stats || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  // Subscribe to real-time updates
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    
    try {
      channel = supabase
        .channel('vendor_activity_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'vendor_activity_log',
          },
          () => {
            // Refresh activities when new ones are added
            if (page === 1) {
              fetchActivities()
            }
          }
        )
        .subscribe()
    } catch (error) {
      // Supabase may not be initialized during build time
      console.warn('Supabase real-time subscription failed:', error)
    }

    return () => {
      if (channel) {
        channel.unsubscribe()
      }
    }
  }, [page, fetchActivities])

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'product':
        return Package
      case 'order':
        return ShoppingCart
      case 'profile':
        return User
      case 'payment':
        return DollarSign
      default:
        return MoreHorizontal
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'product':
        return 'bg-blue-100 text-blue-800'
      case 'order':
        return 'bg-green-100 text-green-800'
      case 'profile':
        return 'bg-purple-100 text-purple-800'
      case 'payment':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTime = (dateString: string) => {
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

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_activities}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Last 24h</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recent_activity_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">By Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {Object.entries(stats.by_category || {}).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between">
                    <span className="capitalize">{cat}:</span>
                    <span className="font-semibold">{count as number}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Top Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {Object.entries(stats.by_type || {})
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 3)
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span className="capitalize truncate">{type.replace('_', ' ')}:</span>
                      <span className="font-semibold">{count as number}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Activity Feed</CardTitle>
            <Button variant="outline" size="sm" onClick={() => fetchActivities()}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ActivityFilters filters={filters} onFiltersChange={setFilters} />

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {loading && page === 1 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-gray-600">No activities found</p>
          ) : (
            <>
              <div className="space-y-3">
                {activities.map((activity) => {
                  const Icon = getCategoryIcon(activity.action_category)
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 rounded-md border border-slate-200 p-3"
                    >
                      <div className={`rounded-full p-2 ${getCategoryColor(activity.action_category)}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getCategoryColor(activity.action_category)}>
                            {activity.action_category}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {activity.vendor_name || activity.vendor_email || activity.vendor_id}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {formatTime(activity.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {hasMore && (
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

