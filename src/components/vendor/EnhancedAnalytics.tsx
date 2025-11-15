'use client'

import React, { useMemo, useState } from 'react'
import { BarChart3, TrendingUp, TrendingDown, Package, Eye, DollarSign, Clock } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { VendorAnalyticsSnapshot } from './types'

interface EnhancedAnalyticsProps {
  analytics: VendorAnalyticsSnapshot | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

type TimeRange = '7d' | '30d' | '90d' | 'all'

export default function EnhancedAnalytics({
  analytics,
  loading,
  error,
  onRetry,
}: EnhancedAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')

  const metrics = analytics?.metrics

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="h-32 animate-pulse bg-slate-100" />
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
          <CardTitle className="text-base font-semibold text-slate-800">No analytics yet</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Once you add products and customers engage with them, performance insights will appear here.
        </CardContent>
      </Card>
    )
  }

  const totalProducts = metrics?.totalProducts ?? 0
  const activeProducts = metrics?.active ?? 0
  const pendingProducts = metrics?.pending ?? 0
  const rejectedProducts = metrics?.rejected ?? 0
  const draftProducts = metrics?.drafts ?? 0
  const archivedProducts = metrics?.archived ?? 0

  const activePercentage = totalProducts > 0 ? Math.round((activeProducts / totalProducts) * 100) : 0
  const pendingPercentage = totalProducts > 0 ? Math.round((pendingProducts / totalProducts) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Analytics Overview</h3>
          <p className="text-sm text-slate-600">Track your product performance and inventory status</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(range)}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
            </Button>
          ))}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-slate-500 mt-1">All listings in your inventory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{activeProducts}</div>
            <p className="text-xs text-slate-500 mt-1">
              {activePercentage}% of total • Live in marketplace
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingProducts}</div>
            <p className="text-xs text-slate-500 mt-1">
              {pendingPercentage}% of total • Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            <TrendingDown className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{rejectedProducts}</div>
            <p className="text-xs text-slate-500 mt-1">Rejected items requiring fixes</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Inventory Status</CardTitle>
            <CardDescription>Breakdown of your product listings by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium">Active</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${activePercentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{activeProducts}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500" />
                  <span className="text-sm font-medium">Pending Review</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-amber-500"
                      style={{ width: `${pendingPercentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{pendingProducts}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-slate-400" />
                  <span className="text-sm font-medium">Drafts</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-slate-400"
                      style={{
                        width: `${totalProducts > 0 ? Math.round((draftProducts / totalProducts) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{draftProducts}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500" />
                  <span className="text-sm font-medium">Rejected</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-rose-500"
                      style={{
                        width: `${totalProducts > 0 ? Math.round((rejectedProducts / totalProducts) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{rejectedProducts}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-gray-400" />
                  <span className="text-sm font-medium">Archived</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-32 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-gray-400"
                      style={{
                        width: `${totalProducts > 0 ? Math.round((archivedProducts / totalProducts) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{archivedProducts}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            <CardDescription>Latest updates to your product listings</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.recentProducts && analytics.recentProducts.length > 0 ? (
              <div className="space-y-3">
                {analytics.recentProducts.slice(0, 5).map((product) => (
                  <div key={product.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-800 line-clamp-1">{product.title}</p>
                      <span
                        className={`whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold ${
                          product.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : product.status === 'pending_review' || product.status === 'pending'
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : product.status === 'rejected'
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {product.status === 'active'
                          ? 'Active'
                          : product.status === 'pending_review' || product.status === 'pending'
                            ? 'Pending'
                            : product.status === 'rejected'
                              ? 'Rejected'
                              : 'Draft'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: product.currency || 'EGP',
                          maximumFractionDigits: 0,
                        }).format(product.price)}
                      </span>
                      <span>
                        {product.updatedAt
                          ? new Date(product.updatedAt).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">No recent activity to display.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Performance Insights</CardTitle>
          <CardDescription>Key metrics and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                <h4 className="font-semibold text-slate-900">Listing Health</h4>
              </div>
              <p className="text-sm text-slate-600">
                {activePercentage >= 70
                  ? 'Excellent! Most of your products are live and available to customers.'
                  : activePercentage >= 50
                    ? 'Good progress. Consider reviewing and activating more draft listings.'
                    : 'Consider activating more products to increase your marketplace presence.'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-5 w-5 text-amber-600" />
                <h4 className="font-semibold text-slate-900">Review Queue</h4>
              </div>
              <p className="text-sm text-slate-600">
                {pendingProducts > 0
                  ? `You have ${pendingProducts} product${pendingProducts > 1 ? 's' : ''} awaiting review. We'll notify you once they're approved.`
                  : 'All your products have been reviewed. Great job!'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

