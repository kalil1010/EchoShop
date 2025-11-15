'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, AlertCircle, X, Sparkles } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface TrendingAlert {
  id: string
  type: 'category' | 'style' | 'color' | 'product'
  title: string
  message: string
  trend: 'up' | 'down'
  percentage: number
  actionUrl?: string
}

interface TrendingAlertsProps {
  vendorId: string
}

export default function TrendingAlerts({ vendorId }: TrendingAlertsProps) {
  const router = useRouter()
  const [alerts, setAlerts] = useState<TrendingAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchTrendingAlerts()
  }, [vendorId])

  const fetchTrendingAlerts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/vendor/trending-alerts', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load trending alerts')
      }

      const payload = await response.json()
      setAlerts(Array.isArray(payload.alerts) ? payload.alerts : [])
    } catch (error) {
      console.error('Failed to fetch trending alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const dismissAlert = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id))
  }

  const visibleAlerts = alerts.filter((alert) => !dismissedIds.has(alert.id))

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Sparkles className="h-4 w-4 animate-pulse" />
            Loading trending insights...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (visibleAlerts.length === 0) {
    return null
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-amber-600" />
          Trending Insights
        </CardTitle>
        <CardDescription>AI-powered alerts about trending products and styles</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-3 rounded-lg border border-amber-200 bg-white p-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp
                  className={`h-4 w-4 ${alert.trend === 'up' ? 'text-emerald-600' : 'text-rose-600'}`}
                />
                <h4 className="font-semibold text-slate-900">{alert.title}</h4>
                <span
                  className={`text-xs font-medium ${
                    alert.trend === 'up' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {alert.trend === 'up' ? '+' : '-'}
                  {alert.percentage}%
                </span>
              </div>
              <p className="text-sm text-slate-600">{alert.message}</p>
              {alert.actionUrl && (
                <button
                  type="button"
                  onClick={() => {
                    // Use Next.js router for client-side navigation
                    // This preserves the session and avoids middleware blocking
                    router.push(alert.actionUrl!)
                  }}
                  className="mt-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-9 rounded-md px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                >
                  View Details
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissAlert(alert.id)}
              className="rounded p-1 text-slate-400 hover:text-slate-600"
              aria-label="Dismiss alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

