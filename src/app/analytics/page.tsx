'use client'

import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'
import { useRequireAuth } from '@/hooks/useRequireAuth'

export default function AnalyticsPage() {
  const { user, loading } = useRequireAuth()

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-96 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!user) {
    return null // useRequireAuth handles redirect
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <AnalyticsDashboard />
    </div>
  )
}

