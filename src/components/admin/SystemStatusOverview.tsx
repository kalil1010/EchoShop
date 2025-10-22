'use client'

import React from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { AdminAnalyticsSnapshot } from './types'

interface SystemStatusOverviewProps {
  analytics: AdminAnalyticsSnapshot | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

const metricFormatter = new Intl.NumberFormat()

const MetricCard = ({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'purple' | 'green' | 'blue' | 'amber'
}) => {
  const toneClass =
    tone === 'green'
      ? 'text-emerald-600'
      : tone === 'blue'
        ? 'text-sky-600'
        : tone === 'amber'
          ? 'text-amber-600'
          : 'text-purple-600'
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-slate-600">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-semibold ${toneClass}`}>
          {metricFormatter.format(value)}
        </p>
      </CardContent>
    </Card>
  )
}

export default function SystemStatusOverview({
  analytics,
  loading,
  error,
  onRetry,
}: SystemStatusOverviewProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="animate-pulse bg-slate-100" />
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
          <CardTitle className="text-base font-semibold text-slate-700">No data available</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Analytics have not been generated yet. Try refreshing or check back later.
        </CardContent>
      </Card>
    )
  }

  const {
    metrics: {
      totals: { users, vendors, admins },
      vendorRequests: { pending, approved },
      products: { total: totalProducts, active: activeProducts },
    },
  } = analytics

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total users" value={users} tone="purple" />
      <MetricCard label="Active vendors" value={vendors} tone="green" />
      <MetricCard label="Team admins" value={admins} tone="blue" />
      <MetricCard label="Active products" value={activeProducts} tone="amber" />
      <MetricCard label="Vendor products total" value={totalProducts} tone="purple" />
      <MetricCard label="Pending vendor requests" value={pending} tone="amber" />
      <MetricCard label="Approved vendor requests" value={approved} tone="green" />
    </div>
  )
}
