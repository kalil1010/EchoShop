'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { DisputeTimeline } from './DisputeTimeline'
import { DisputeEvidenceViewer } from './DisputeEvidenceViewer'
import { AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react'

interface Dispute {
  id: string
  order_id: string
  vendor_id: string
  customer_id: string
  dispute_type: string
  status: 'open' | 'investigating' | 'resolved' | 'closed' | 'escalated'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  title: string
  description: string
  customer_claim: string | null
  vendor_response: string | null
  resolution: string | null
  resolved_amount: number | null
  created_at: string
  order_number?: string
  vendor_name?: string
  customer_name?: string
}

export function DisputeResolution() {
  const { toast } = useToast()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null)

  useEffect(() => {
    fetchDisputes()
  }, [statusFilter])

  const fetchDisputes = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const response = await fetch(`/api/admin/disputes?${params.toString()}`, {
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

  const handleResolve = async (disputeId: string, resolution: string, amount?: number) => {
    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolution, resolved_amount: amount }),
      })

      if (!response.ok) {
        throw new Error('Failed to resolve dispute')
      }

      toast({
        title: 'Success',
        description: 'Dispute resolved',
        variant: 'success',
      })

      fetchDisputes()
      setSelectedDispute(null)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to resolve dispute',
        variant: 'error',
      })
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
      case 'escalated':
        return 'bg-red-100 text-red-800'
      case 'closed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dispute Resolution</CardTitle>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
              </select>
              <Button variant="outline" size="sm" onClick={fetchDisputes}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-md bg-gray-100" />
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
                  className="rounded-md border border-slate-200 p-4 space-y-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedDispute(dispute)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{dispute.title}</span>
                        <Badge className={getStatusColor(dispute.status)}>
                          {dispute.status}
                        </Badge>
                        <Badge className={getPriorityColor(dispute.priority)}>
                          {dispute.priority}
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-800">
                          {dispute.dispute_type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700">{dispute.description}</p>
                      <div className="text-xs text-gray-500 mt-2 space-y-1">
                        <p>Order: {dispute.order_number || dispute.order_id}</p>
                        <p>Vendor: {dispute.vendor_name || dispute.vendor_id}</p>
                        <p>Customer: {dispute.customer_name || dispute.customer_id}</p>
                        {dispute.resolved_amount && (
                          <p className="font-semibold text-green-600">
                            Resolved: {dispute.resolved_amount.toLocaleString()} EGP
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
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

      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Dispute Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDispute(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Dispute Information</h3>
                <div className="space-y-1 text-sm">
                  <div><strong>Type:</strong> {selectedDispute.dispute_type}</div>
                  <div><strong>Status:</strong> {selectedDispute.status}</div>
                  <div><strong>Priority:</strong> {selectedDispute.priority}</div>
                  <div><strong>Order:</strong> {selectedDispute.order_number || selectedDispute.order_id}</div>
                </div>
              </div>

              {selectedDispute.customer_claim && (
                <div>
                  <h3 className="font-semibold mb-2">Customer Claim</h3>
                  <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded">
                    {selectedDispute.customer_claim}
                  </p>
                </div>
              )}

              {selectedDispute.vendor_response && (
                <div>
                  <h3 className="font-semibold mb-2">Vendor Response</h3>
                  <p className="text-sm text-gray-700 bg-green-50 p-3 rounded">
                    {selectedDispute.vendor_response}
                  </p>
                </div>
              )}

              <DisputeEvidenceViewer disputeId={selectedDispute.id} />
              <DisputeTimeline disputeId={selectedDispute.id} />

              {selectedDispute.status !== 'resolved' && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => {
                      const resolution = prompt('Resolution notes:')
                      const amount = prompt('Resolved amount (if applicable):')
                      if (resolution) {
                        handleResolve(
                          selectedDispute.id,
                          resolution,
                          amount ? parseFloat(amount) : undefined
                        )
                      }
                    }}
                  >
                    Resolve Dispute
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

