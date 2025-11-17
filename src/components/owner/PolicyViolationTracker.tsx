'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'

interface Violation {
  id: string
  vendor_id: string
  product_id: string | null
  violation_type: string
  violation_reason: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
  vendor_name?: string
  product_title?: string
}

export function PolicyViolationTracker() {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchViolations()
  }, [])

  const fetchViolations = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/products/moderation/violations', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load violations')
      }

      const data = await response.json()
      setViolations(data.violations || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load violations')
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Policy Violations</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : violations.length === 0 ? (
          <p className="text-sm text-gray-600">No violations found</p>
        ) : (
          <div className="space-y-3">
            {violations.map((violation) => (
              <div
                key={violation.id}
                className="rounded-md border border-slate-200 p-4 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="font-semibold">{violation.violation_type}</span>
                  <Badge className={getSeverityColor(violation.severity)}>
                    {violation.severity}
                  </Badge>
                </div>
                <p className="text-sm text-gray-700">{violation.violation_reason}</p>
                <div className="text-xs text-gray-500">
                  <p>Vendor: {violation.vendor_name || violation.vendor_id}</p>
                  {violation.product_title && (
                    <p>Product: {violation.product_title}</p>
                  )}
                  <p>{new Date(violation.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

