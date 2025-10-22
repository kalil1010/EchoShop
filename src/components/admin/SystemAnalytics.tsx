'use client'

import React from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { AdminAnalyticsSnapshot } from './types'

interface SystemAnalyticsProps {
  analytics: AdminAnalyticsSnapshot | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleString()
}

const statusTone: Record<string, string> = {
  pending: 'text-amber-600',
  approved: 'text-emerald-600',
  rejected: 'text-rose-600',
}

export default function SystemAnalytics({
  analytics,
  loading,
  error,
  onRetry,
}: SystemAnalyticsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="h-48 animate-pulse bg-slate-100" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-rose-50 border-rose-200">
        <CardHeader>
          <CardTitle className="text-rose-700">Analytics unavailable</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-rose-600">{error}</p>
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-700">No analytics yet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Activity data will appear once the platform records user sign ups and vendor activity.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">Recent sign ups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analytics.recentUsers.length === 0 ? (
            <p className="text-sm text-slate-500">No new accounts created in the recent period.</p>
          ) : (
            analytics.recentUsers.map((user) => (
              <div key={user.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-800">{user.label ?? 'Unknown'}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{user.role ?? 'user'}</p>
                <p className="text-xs text-slate-500">Joined {formatDate(user.createdAt)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">
            Latest vendor requests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analytics.recentVendorRequests.length === 0 ? (
            <p className="text-sm text-slate-500">No vendor submissions yet.</p>
          ) : (
            analytics.recentVendorRequests.map((request) => {
              const tone = statusTone[request.status ?? ''] ?? 'text-slate-500'
              return (
                <div key={request.id} className="rounded-md border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-800">{request.label ?? 'Unknown business'}</p>
                  <p className={`text-xs uppercase tracking-wide ${tone}`}>
                    {request.status ?? 'pending'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Submitted {formatDate(request.createdAt)}
                  </p>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
