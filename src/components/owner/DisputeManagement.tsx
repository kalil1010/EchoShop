'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, FileText, CheckCircle, XCircle } from 'lucide-react'

interface Dispute {
  id: string
  payout_id: string
  payout_number: string
  vendor_id: string
  vendor_name?: string
  amount: number
  currency: string
  dispute_type: 'chargeback' | 'refund_request' | 'payment_dispute'
  status: 'open' | 'investigating' | 'resolved' | 'closed'
  description: string
  created_at: string
  resolved_at?: string
}

export function DisputeManagement() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDisputes()
  }, [])

  const fetchDisputes = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/payouts/disputes', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load disputes')
      }

      const data = await response.json()
      setDisputes(data.disputes || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load disputes')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'investigating':
        return 'bg-blue-100 text-blue-800'
      case 'open':
        return 'bg-yellow-100 text-yellow-800'
      case 'closed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'chargeback':
        return 'bg-red-100 text-red-800'
      case 'refund_request':
        return 'bg-orange-100 text-orange-800'
      case 'payment_dispute':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispute Management</CardTitle>
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
        ) : disputes.length === 0 ? (
          <p className="text-sm text-gray-600">No disputes found</p>
        ) : (
          <div className="space-y-3">
            {disputes.map((dispute) => (
              <div
                key={dispute.id}
                className="rounded-md border border-slate-200 p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{dispute.payout_number}</span>
                      <Badge className={getTypeColor(dispute.dispute_type)}>
                        {dispute.dispute_type.replace('_', ' ')}
                      </Badge>
                      <Badge className={getStatusColor(dispute.status)}>
                        {dispute.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Vendor: {dispute.vendor_name || dispute.vendor_id}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">{dispute.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {dispute.amount.toLocaleString()} {dispute.currency}
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(dispute.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

