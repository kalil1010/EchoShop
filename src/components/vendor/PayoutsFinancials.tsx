'use client'

import React, { useEffect, useState } from 'react'
import {
  DollarSign,
  Calendar,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  TrendingUp,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'

interface Payout {
  id: string
  payout_number: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled'
  payout_date: string
  paid_at: string | null
  payment_method: string | null
  payment_reference: string | null
  notes: string | null
  created_at: string
}

interface PayoutSummary {
  pending_amount: number
  total_paid: number
  pending_count: number
  paid_count: number
}

const STATUS_COLORS = {
  pending: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  processing: 'text-blue-600 bg-blue-50 border-blue-200',
  paid: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  failed: 'text-red-600 bg-red-50 border-red-200',
  cancelled: 'text-slate-600 bg-slate-50 border-slate-200',
}

const STATUS_ICONS = {
  pending: Clock,
  processing: Loader2,
  paid: CheckCircle2,
  failed: XCircle,
  cancelled: XCircle,
}

export default function PayoutsFinancials() {
  const { userProfile } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [summary, setSummary] = useState<PayoutSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    loadPayouts()
  }, [])

  const loadPayouts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/vendor/payouts?includeSummary=true', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load payouts')
      }

      const data = await response.json()
      setPayouts(data.payouts || [])
      setSummary(data.summary || null)
    } catch (error) {
      toast({
        title: 'Failed to load payouts',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadStatement = async (payoutId: string, payoutNumber: string) => {
    setDownloading(payoutId)
    try {
      const response = await fetch(`/api/vendor/payouts/${payoutId}/statement`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to generate statement')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payout-${payoutNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: 'Statement downloaded',
        description: 'Your payout statement has been downloaded.',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Failed to download statement',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setDownloading(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EGP',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
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
              <CardTitle className="text-sm font-medium text-slate-600">Pending Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(summary.pending_amount, 'EGP')}
              </div>
              <p className="text-xs text-slate-500 mt-1">Awaiting payout</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(summary.total_paid, 'EGP')}
              </div>
              <p className="text-xs text-slate-500 mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Pending Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.pending_count}</div>
              <p className="text-xs text-slate-500 mt-1">In process</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Completed Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">{summary.paid_count}</div>
              <p className="text-xs text-slate-500 mt-1">Successfully paid</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payouts List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">Payout History</CardTitle>
          <CardDescription>View and download your payout statements</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No payouts yet</p>
              <p className="text-sm text-slate-400 mt-2">
                Payouts will appear here once orders are completed and processed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => {
                const StatusIcon = STATUS_ICONS[payout.status]
                const statusColor = STATUS_COLORS[payout.status]

                return (
                  <div
                    key={payout.id}
                    className={`rounded-lg border p-4 ${statusColor}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <StatusIcon
                            className={`h-4 w-4 ${payout.status === 'processing' ? 'animate-spin' : ''}`}
                          />
                          <h4 className="font-semibold text-sm">{payout.payout_number}</h4>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/50">
                            {payout.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            <span className="font-semibold">
                              {formatCurrency(payout.amount, payout.currency)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Payout Date: {formatDate(payout.payout_date)}</span>
                          </div>
                          {payout.paid_at && (
                            <div className="text-xs text-slate-500">
                              Paid: {new Date(payout.paid_at).toLocaleString()}
                            </div>
                          )}
                          {payout.payment_reference && (
                            <div className="text-xs text-slate-500">
                              Reference: {payout.payment_reference}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadStatement(payout.id, payout.payout_number)}
                        disabled={downloading === payout.id}
                      >
                        {downloading === payout.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Statement
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

