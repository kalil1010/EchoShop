'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { UploadCloud, BarChart3, Building2, MessageSquare, DollarSign } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import type { VendorProduct } from '@/types/vendor'
import EnhancedProductManagement from './EnhancedProductManagement'
import EnhancedAnalytics from './EnhancedAnalytics'
import BusinessProfile from './BusinessProfile'
import EnhancedOrderManagement from './EnhancedOrderManagement'
import TrendingAlerts from './TrendingAlerts'
import VendorOnboardingWizard from './VendorOnboardingWizard'
import SecuritySettings from './SecuritySettings'
import VendorOwnerMessages from './VendorOwnerMessages'
import NotificationCenter from './NotificationCenter'
import NotificationBell from './NotificationBell'
import PayoutsFinancials from './PayoutsFinancials'
import type { VendorAnalyticsSnapshot } from './types'

type VendorTab = 'overview' | 'products' | 'analytics' | 'business' | 'orders' | 'payouts' | 'messages' | 'security'

const TABS: Array<{ key: VendorTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'products', label: 'Products' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'business', label: 'Business profile' },
  { key: 'orders', label: 'Orders' },
  { key: 'payouts', label: 'Payouts & Financials' },
  { key: 'messages', label: 'Messages' },
  { key: 'security', label: 'Security' },
]

type VendorAnalyticsResponse = {
  metrics?: {
    totalProducts?: number
    total?: number
    drafts?: number
    pending?: number
    pending_review?: number
    active?: number
    rejected?: number
    archived?: number
  }
  recentProducts?: Array<{
    id?: unknown
    title?: unknown
    status?: unknown
    price?: unknown
    currency?: unknown
    createdAt?: unknown
    updatedAt?: unknown
  }>
}

const adaptAnalytics = (payload: VendorAnalyticsResponse | null | undefined): VendorAnalyticsSnapshot => ({
  metrics: {
    totalProducts: Number(payload?.metrics?.totalProducts ?? payload?.metrics?.total ?? 0),
    drafts: Number(payload?.metrics?.drafts ?? 0),
    pending: Number(payload?.metrics?.pending ?? payload?.metrics?.pending_review ?? 0),
    active: Number(payload?.metrics?.active ?? 0),
    rejected: Number(payload?.metrics?.rejected ?? 0),
    archived: Number(payload?.metrics?.archived ?? 0),
  },
  recentProducts: Array.isArray(payload?.recentProducts)
    ? payload.recentProducts.map((item) => ({
        id: String(item?.id ?? ''),
        title: typeof item?.title === 'string' ? item.title : 'Untitled product',
        status: typeof item?.status === 'string' ? item.status : 'draft',
        price: typeof item?.price === 'number' ? item.price : Number.parseFloat(String(item?.price ?? '0')),
        currency: typeof item?.currency === 'string' ? item.currency : 'EGP',
        createdAt: typeof item?.createdAt === 'string' ? item.createdAt : null,
        updatedAt: typeof item?.updatedAt === 'string' ? item.updatedAt : null,
      }))
    : [],
})

export default function VendorDashboardLayout() {
  const { userProfile, roleMeta } = useAuth()
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

  const vendorId = userProfile?.uid ?? ''

  const quickActions = useMemo(
    () => [
      {
        key: 'products',
        icon: UploadCloud,
        title: 'Upload a product',
        description: 'Add new listings and track their moderation status.',
        tab: 'products' as const,
      },
      {
        key: 'analytics',
        icon: BarChart3,
        title: 'Review analytics',
        description: 'See how drafts, pending items, and approvals are trending.',
        tab: 'analytics' as const,
      },
      {
        key: 'business',
        icon: Building2,
        title: 'Update business profile',
        description: 'Keep contact details and storefront messaging up to date.',
        tab: 'business' as const,
      },
    ],
    [],
  )

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

  // Handle onboarding navigation events
  useEffect(() => {
    const handleOnboardingNavigate = (event: CustomEvent<{ tab: string }>) => {
      const tab = event.detail.tab
      if (TABS.some((t) => t.key === tab)) {
        setActiveTab(tab as VendorTab)
      }
    }

    window.addEventListener('vendor-onboarding-navigate', handleOnboardingNavigate as EventListener)
    return () => {
      window.removeEventListener('vendor-onboarding-navigate', handleOnboardingNavigate as EventListener)
    }
  }, [])

  // Mark analytics as visited when tab is switched to analytics
  useEffect(() => {
    if (activeTab === 'analytics' && userProfile?.uid) {
      const analyticsVisitedKey = `vendor_onboarding_analytics_visited_${userProfile.uid}`
      localStorage.setItem(analyticsVisitedKey, 'true')
    }
  }, [activeTab, userProfile?.uid])

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
        <div className="md:col-span-2 xl:col-span-3">
          <NotificationCenter />
        </div>
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
        return (
          <EnhancedProductManagement
            key={productKey}
            products={products}
            vendorName={vendorName}
            onProductUpdated={fetchProducts}
          />
        )
      case 'analytics':
        return (
          <EnhancedAnalytics
            analytics={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            onRetry={fetchAnalytics}
          />
        )
      case 'business':
        return <BusinessProfile />
      case 'orders':
        return <EnhancedOrderManagement vendorId={userProfile?.uid ?? ''} />
      case 'payouts':
        return <PayoutsFinancials />
      case 'messages':
        return <VendorOwnerMessages />
      case 'security':
        return <SecuritySettings />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <Card
        data-tour="vendor-welcome-card"
        className="border-emerald-100 bg-emerald-50/60 backdrop-blur-sm"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-900">
            {roleMeta.welcomeTitle} 👋
          </CardTitle>
          <CardDescription className="text-sm text-emerald-800">
            {roleMeta.welcomeSubtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <div
              key={action.key}
              data-tour={`vendor-action-${action.key}`}
              className="flex h-full flex-col justify-between rounded-lg border border-emerald-100 bg-white/80 p-4 shadow-sm"
            >
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-emerald-700">
                  <action.icon className="h-4 w-4" />
                  <span className="text-sm font-semibold">{action.title}</span>
                </div>
                <p className="text-sm text-emerald-800">{action.description}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-3 w-fit px-0 text-emerald-700 hover:text-emerald-900"
                onClick={() => setActiveTab(action.tab)}
              >
                Go now →
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1">
          <h1 className="text-3xl font-bold text-slate-900">Atlas vendor console</h1>
          <p className="text-sm text-slate-600">
            Manage {vendorName}&apos;s marketplace presence, track performance, and keep your business
            details current.
          </p>
        </div>
        <NotificationBell />
      </header>

      {/* Onboarding Wizard */}
      <VendorOnboardingWizard />

      {/* Trending Alerts */}
      <TrendingAlerts vendorId={vendorId} />

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.key)}
            data-tour={`vendor-tab-${tab.key}`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <section className="space-y-6">{renderContent()}</section>
    </div>
  )
}
