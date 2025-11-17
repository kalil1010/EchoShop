'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VendorHealthBadge } from './VendorHealthBadge'
import { supabase } from '@/lib/supabase'
import type { VendorHealthStatus } from '@/lib/vendorHealthCalculation'

interface VendorHealthDetailsProps {
  vendorId: string
}

interface VendorHealthData {
  vendor_id: string
  overall_score: number
  status: VendorHealthStatus
  dispute_score: number
  quality_score: number
  compliance_score: number
  response_score: number
  payment_score: number
  total_orders: number
  dispute_count: number
  return_count: number
  avg_customer_rating: number
  moderation_violations: number
  payment_failures: number
  days_since_last_violation: number | null
  last_violation_date: string | null
  last_calculated: string
}

export function VendorHealthDetails({ vendorId }: VendorHealthDetailsProps) {
  const [health, setHealth] = useState<VendorHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchHealth()
    
    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`vendor_health_${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_health_scores',
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          fetchHealth()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [vendorId])

  const fetchHealth = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/vendor-health/${vendorId}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error('Failed to load health data')
      }
      
      const data = await response.json()
      setHealth(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!health) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-gray-600">No health data available for this vendor.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Vendor Health Score</CardTitle>
          <VendorHealthBadge score={health.overall_score} status={health.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Breakdown */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Score Breakdown</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Dispute Score</span>
                <span className="font-semibold">{health.dispute_score.toFixed(1)}/100</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${health.dispute_score}%` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Quality Score</span>
                <span className="font-semibold">{health.quality_score.toFixed(1)}/100</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${health.quality_score}%` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Compliance Score</span>
                <span className="font-semibold">{health.compliance_score.toFixed(1)}/100</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500"
                  style={{ width: `${health.compliance_score}%` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Response Score</span>
                <span className="font-semibold">{health.response_score.toFixed(1)}/100</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500"
                  style={{ width: `${health.response_score}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Key Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600">Total Orders</label>
              <div className="text-2xl font-bold text-gray-900">{health.total_orders}</div>
            </div>
            <div>
              <label className="text-xs text-gray-600">Disputes</label>
              <div className="text-2xl font-bold text-red-600">{health.dispute_count}</div>
            </div>
            <div>
              <label className="text-xs text-gray-600">Returns</label>
              <div className="text-2xl font-bold text-orange-600">{health.return_count}</div>
            </div>
            <div>
              <label className="text-xs text-gray-600">Avg Rating</label>
              <div className="text-2xl font-bold text-blue-600">
                {health.avg_customer_rating.toFixed(1)}/5
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-600">Violations</label>
              <div className="text-2xl font-bold text-yellow-600">{health.moderation_violations}</div>
            </div>
            <div>
              <label className="text-xs text-gray-600">Payment Failures</label>
              <div className="text-2xl font-bold text-red-600">{health.payment_failures}</div>
            </div>
          </div>
        </div>

        {/* Last Updated */}
        <div className="text-xs text-gray-500 pt-4 border-t">
          Last calculated: {new Date(health.last_calculated).toLocaleString()}
          {health.days_since_last_violation !== null && (
            <span className="ml-4">
              Days since last violation: {health.days_since_last_violation}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

