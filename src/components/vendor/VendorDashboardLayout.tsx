'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import type { VendorProduct } from '@/types/vendor'
import ProductManagement from './ProductManagement'
import VendorAnalytics from './VendorAnalytics'
import BusinessProfile from './BusinessProfile'
import OrderManagement from './OrderManagement'
import type { VendorAnalyticsSnapshot } from './types'

type VendorTab = 'overview' | 'products' | 'analytics' | 'business' | 'orders'

const TABS: Array<{ key: VendorTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'products', label: 'Products' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'business', label: 'Business profile' },
  { key: 'orders', label: 'Orders' },
]

const adaptAnalytics = (payload: any): VendorAnalyticsSnapshot => ({
  metrics: {
    totalProducts: Number(payload?.metrics?.totalProducts ?? payload?.metrics?.total ?? 0),
    drafts: Number(payload?.metrics?.drafts ?? 0),
    pending: Number(payload?.metrics?.pending ?? payload?.metrics?.pending_review ?? 0),
    active: Number(payload?.metrics?.active ?? 0),
    rejected: Number(payload?.metrics?.rejected ?? 0),
    archived: Number(payload?.metrics?.archived ?? 0),
  },
  recentProducts: Array.isArray(payload?.recentProducts)
    ? payload.recentProducts.map((item: any) => ({
        id: String(item?.id ?? ''),
        title: typeof item?.title === 'string' ? item.title : 'Untitled product',
        status: typeof item?.status === 'string' ? item.status : 'draft',
        price: Number.parseFloat(item?.price ?? '0'),
        currency: typeof item?.currency === 'string' ? item.currency : 'EGP',
        createdAt: typeof item?.createdAt === 'string' ? item.createdAt : null,
        updatedAt: typeof item?.updatedAt === 'string' ? item.updatedAt : null,
      }))
    : [],
})

export default function VendorDashboardLayout() {
  const { userProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<VendorTab>('overview')
  const [products, setProducts] = useState<VendorProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [productKey, setProductKey] = useState(0)

  const [analytics, setAnalytics] = useState<VendorAnalyticsSnapshot | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

  const vendorName = useMemo(() => {
    if (!userProfile) return 'Vendor'
    return (
      userProfile.vendorBusinessName ??
      userProfile.displayName ??
      userProfile.email ??
      'Vendor'
    )
  }, [userProfile])

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true)
    setProductsError(null)
    try {
      const response = await fetch('/api/vendor/products', { credentials: 'include' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to load products.')
      }
      const payload = await response.json()
      const list: VendorProduct[] = Array.isArray(payload?.products) ? payload.products : []
      setProducts(list)
      setProductKey((key) => key + 1)
    } catch (requestError) {
      setProductsError(requestError instanceof Error ? requestError.message : 'Unable to load products.')
    } finally {
      setProductsLoading(false)
    }
  }, [])

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    try {
      const response = await fetch('/api/vendor/analytics', { credentials: 'include' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to load analytics.')
      }
      const payload = await response.json()
      setAnalytics(adaptAnalytics(payload))
    } catch (requestError) {
      setAnalyticsError(
        requestError instanceof Error ? requestError.message : 'Unable to load analytics.',
      )
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchAnalytics()
  }, [fetchProducts, fetchAnalytics])

  const overviewMetrics = analytics?.metrics

  const renderOverview = () => {
    if (analyticsLoading) {
      return (
        <Card className="animate-pulse bg-slate-100">
          <CardHeader>
            <CardTitle className="text-slate-500">Loading overview...</CardTitle>
          </CardHeader>
          <CardContent className="h-32" />
        </Card>
      )
    }

    if (analyticsError) {
      return (
        <Card className="bg-rose-50 border-rose-200">
          <CardHeader>
            <CardTitle className="text-rose-700">Overview unavailable</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-rose-600">{analyticsError}</p>
            <Button variant="outline" onClick={fetchAnalytics}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )
    }

    if (!overviewMetrics) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">
              No data yet
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Start by adding your first product. Once published, performance highlights will appear here.
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-700">Active listings</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-emerald-600">
            {overviewMetrics.active}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-700">
              Pending review
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-amber-600">
            {overviewMetrics.pending}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-700">
              Total products
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-slate-700">
            {overviewMetrics.totalProducts}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-700">
              Draft ideas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-slate-600">
            {overviewMetrics.drafts}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-700">
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-rose-600">
            {overviewMetrics.rejected}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-700">
              Archived
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-slate-500">
            {overviewMetrics.archived}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview()
      case 'products':
        if (productsLoading) {
          return (
            <Card className="animate-pulse bg-slate-100">
            <CardHeader>
              <CardTitle className="text-slate-500">Loading products...</CardTitle>
              </CardHeader>
              <CardContent className="h-48" />
            </Card>
          )
        }
        if (productsError) {
          return (
            <Card className="bg-rose-50 border-rose-200">
              <CardHeader>
                <CardTitle className="text-rose-700">Products unavailable</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <p className="text-sm text-rose-600">{productsError}</p>
                <Button variant="outline" onClick={fetchProducts}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          )
        }
        return <ProductManagement key={productKey} products={products} vendorName={vendorName} />
      case 'analytics':
        return (
          <VendorAnalytics
            analytics={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            onRetry={fetchAnalytics}
          />
        )
      case 'business':
        return <BusinessProfile />
      case 'orders':
        return <OrderManagement />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Welcome back, {vendorName}</h1>
        <p className="text-sm text-slate-600">
          Manage your marketplace presence, track performance, and keep your business details current.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <section className="space-y-6">{renderContent()}</section>
    </div>
  )
}
