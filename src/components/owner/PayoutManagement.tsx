'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { PayoutHoldDialog } from './PayoutHoldDialog'
import { 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Filter,
  Download
} from 'lucide-react'

interface Payout {
  id: string
  vendor_id: string
  payout_number: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled'
  payout_date: string
  paid_at: string | null
  is_held: boolean
  hold_reason: string | null
  dispute_count: number
  chargeback_count: number
  refund_amount: number
  kyc_verified: boolean
  tax_docs_verified: boolean
  compliance_status: 'pending' | 'verified' | 'rejected' | 'expired'
  vendor_name?: string
  vendor_email?: string
}

interface PayoutSummary {
  total_pending: number
  total_held: number
  total_processing: number
  total_paid: number
  total_failed: number
  pending_amount: number
  held_amount: number
}

export function PayoutManagement() {
  const { toast } = useToast()
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [summary, setSummary] = useState<PayoutSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null)
  const [showHoldDialog, setShowHoldDialog] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [heldFilter, setHeldFilter] = useState<boolean | null>(null)

  const fetchPayouts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      if (heldFilter !== null) {
        params.set('held', heldFilter.toString())
      }
      
      const response = await fetch(`/api/admin/payouts?${params.toString()}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error('Failed to load payouts')
      }
      
      const data = await response.json()
      setPayouts(data.payouts || [])
      setSummary(data.summary || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payouts')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, heldFilter])

  useEffect(() => {
    fetchPayouts()
  }, [fetchPayouts])

  const handleHold = (payout: Payout) => {
    setSelectedPayout(payout)
    setShowHoldDialog(true)
  }

  const handleRelease = async (payoutId: string) => {
    try {
      const response = await fetch(`/api/admin/payouts/${payoutId}/release`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to release payout')
      }

      toast({
        title: 'Success',
        description: 'Payout released successfully',
        variant: 'success',
      })

      fetchPayouts()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to release payout',
        variant: 'error',
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'expired':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading && !summary) {
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {summary.pending_amount.toLocaleString()} EGP
              </div>
              <p className="text-xs text-gray-500 mt-1">{summary.total_pending} payouts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Held Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {summary.held_amount.toLocaleString()} EGP
              </div>
              <p className="text-xs text-gray-500 mt-1">{summary.total_held} payouts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {summary.total_processing}
              </div>
              <p className="text-xs text-gray-500 mt-1">payouts in progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary.total_paid.toLocaleString()} EGP
              </div>
              <p className="text-xs text-gray-500 mt-1">{summary.total_paid} payouts</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payout Management</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchPayouts}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={heldFilter === null ? 'all' : heldFilter ? 'held' : 'not-held'}
              onChange={(e) => {
                const value = e.target.value
                setHeldFilter(value === 'all' ? null : value === 'held')
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm"
            >
              <option value="all">All Payouts</option>
              <option value="held">Held Only</option>
              <option value="not-held">Not Held</option>
            </select>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : payouts.length === 0 ? (
            <p className="text-sm text-gray-600">No payouts found</p>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="rounded-md border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{payout.payout_number}</span>
                        <Badge className={getStatusColor(payout.status)}>
                          {payout.status}
                        </Badge>
                        {payout.is_held && (
                          <Badge className="bg-red-100 text-red-800">
                            Held
                          </Badge>
                        )}
                        <Badge className={getComplianceColor(payout.compliance_status)}>
                          {payout.compliance_status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Vendor: {payout.vendor_name || payout.vendor_email || payout.vendor_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {payout.amount.toLocaleString()} {payout.currency}
                      </div>
                      <p className="text-xs text-gray-500">
                        Due: {new Date(payout.payout_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {(payout.dispute_count > 0 || payout.chargeback_count > 0 || payout.refund_amount > 0) && (
                    <div className="flex gap-4 text-xs text-red-600 pt-2 border-t">
                      {payout.dispute_count > 0 && (
                        <span>Disputes: {payout.dispute_count}</span>
                      )}
                      {payout.chargeback_count > 0 && (
                        <span>Chargebacks: {payout.chargeback_count}</span>
                      )}
                      {payout.refund_amount > 0 && (
                        <span>Refunds: {payout.refund_amount.toLocaleString()} {payout.currency}</span>
                      )}
                    </div>
                  )}

                  {payout.is_held && payout.hold_reason && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      <strong>Hold Reason:</strong> {payout.hold_reason}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {payout.is_held ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRelease(payout.id)}
                      >
                        Release
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleHold(payout)}
                      >
                        Hold
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showHoldDialog && selectedPayout && (
        <PayoutHoldDialog
          payout={selectedPayout}
          open={showHoldDialog}
          onClose={() => {
            setShowHoldDialog(false)
            setSelectedPayout(null)
          }}
          onSuccess={fetchPayouts}
        />
      )}
    </div>
  )
}

