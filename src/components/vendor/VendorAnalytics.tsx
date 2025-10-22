'use client'

import React from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { VendorAnalyticsSnapshot } from './types'

interface VendorAnalyticsProps {
  analytics: VendorAnalyticsSnapshot | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending review',
  pending_review: 'Pending review',
  active: 'Active',
  rejected: 'Rejected',
  archived: 'Archived',
}

const statusTone: Record<string, string> = {
  draft: 'text-slate-600',
  pending_review: 'text-amber-600',
  pending: 'text-amber-600',
  active: 'text-emerald-600',
  rejected: 'text-rose-600',
  archived: 'text-slate-500',
}

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0,
  )

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleString()
}

export default function VendorAnalytics({
  analytics,
  loading,
  error,
  onRetry,
}: VendorAnalyticsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="h-40 animate-pulse bg-slate-100" />
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
          <CardTitle className="text-base font-semibold text-slate-800">
            No analytics yet
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Once you add products and customers engage with them, performance insights will appear here.
        </CardContent>
      </Card>
    )
  }

  const { metrics, recentProducts } = analytics

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">
            Inventory overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Total listings</span>
            <span className="font-semibold text-slate-800">{metrics.totalProducts}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Live in marketplace</span>
            <span className="font-semibold text-emerald-600">{metrics.active}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Awaiting review</span>
            <span className="font-semibold text-amber-600">{metrics.pending}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Drafts</span>
            <span className="font-semibold text-slate-700">{metrics.drafts}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Rejected</span>
            <span className="font-semibold text-rose-600">{metrics.rejected}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Archived</span>
            <span className="font-semibold text-slate-500">{metrics.archived}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">
            Recent updates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentProducts.length === 0 ? (
            <p className="text-sm text-slate-600">Add products to see them tracked here.</p>
          ) : (
            recentProducts.map((product) => {
              const tone = statusTone[product.status?.toLowerCase()] ?? 'text-slate-500'
              const statusLabel = statusLabels[product.status?.toLowerCase()] ?? product.status
              return (
                <div key={product.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">{product.title}</p>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${tone}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{formatCurrency(product.price, product.currency)}</span>
                    <span>Updated {formatDate(product.updatedAt)}</span>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
