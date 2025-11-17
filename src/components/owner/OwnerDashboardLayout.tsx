'use client'

import React, { useCallback, useEffect, useMemo, useState, memo } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Inbox, BarChart3, Users, LogOut, Shield, MessageSquare, Activity, DollarSign, Flag, Bell, FileText, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import SystemStatusOverview from './SystemStatusOverview'
import UserManagement from './UserManagement'
import VendorRequestsPanel from './VendorRequestsPanel'
import VendorManagement from './VendorManagement'
import SystemAnalytics from './SystemAnalytics'
import OwnerInvitations from './OwnerInvitations'
import OwnerSecuritySettings from './OwnerSecuritySettings'
import OwnerSupportTickets from './OwnerSupportTickets'
import { VendorHealthScoring } from './VendorHealthScoring'
import { PayoutManagement } from './PayoutManagement'
import { ActivityFeed } from './ActivityFeed'
import { AuditLogViewer } from './AuditLogViewer'
import { FeatureFlagsPanel } from './FeatureFlagsPanel'
import { AlertCenter } from './AlertCenter'
import type { OwnerAnalyticsSnapshot } from './types'
import { analyticsCache } from '@/lib/analyticsCache'

type OwnerTab =
  | 'overview'
  | 'users'
  | 'vendors'
  | 'requests'
  | 'support'
  | 'invitations'
  | 'analytics'
  | 'security'
  | 'health'
  | 'payouts'
  | 'activity'
  | 'audit'
  | 'features'

const TABS: Array<{ key: OwnerTab; label: string; icon: typeof ShieldCheck }> = [
  { key: 'overview', label: 'Overview', icon: ShieldCheck },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'vendors', label: 'Vendors', icon: Users },
  { key: 'requests', label: 'Vendor Requests', icon: Inbox },
  { key: 'support', label: 'Support Tickets', icon: MessageSquare },
  { key: 'invitations', label: 'Invitations', icon: Shield },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'health', label: 'Vendor Health', icon: ShieldCheck },
  { key: 'payouts', label: 'Payouts', icon: DollarSign },
  { key: 'activity', label: 'Activity Feed', icon: Activity },
  { key: 'audit', label: 'Audit Log', icon: FileText },
  { key: 'features', label: 'Feature Flags', icon: Flag },
  { key: 'security', label: 'Security', icon: Shield },
]

type OwnerAnalyticsResponse = {
  metrics?: {
    totals?: { users?: number; vendors?: number; owners?: number }
    vendorRequests?: { pending?: number; approved?: number }
    products?: { total?: number; active?: number }
  }
  recentUsers?: Array<{
    id?: unknown
    label?: unknown
    role?: unknown
    created_at?: unknown
  }>
  recentVendorRequests?: Array<{
    id?: unknown
    label?: unknown
    status?: unknown
    created_at?: unknown
  }>
}

const adaptAnalytics = (payload: OwnerAnalyticsResponse | null | undefined): OwnerAnalyticsSnapshot => {
  const metrics = payload?.metrics ?? {}
  const recentUsers = Array.isArray(payload?.recentUsers)
    ? payload.recentUsers.map((user) => ({
        id: String(user?.id ?? ''),
        label: typeof user?.label === 'string' ? user.label : null,
        role: typeof user?.role === 'string' ? user.role : null,
        createdAt: typeof user?.created_at === 'string' ? user.created_at : null,
      }))
    : []
  const recentVendorRequests = Array.isArray(payload?.recentVendorRequests)
    ? payload.recentVendorRequests.map((item) => ({
        id: String(item?.id ?? ''),
        label: typeof item?.label === 'string' ? item.label : null,
        status: typeof item?.status === 'string' ? item.status : null,
        createdAt: typeof item?.created_at === 'string' ? item.created_at : null,
      }))
    : []

  return {
    metrics: {
      totals: {
        users: Number(metrics?.totals?.users ?? 0),
        vendors: Number(metrics?.totals?.vendors ?? 0),
        owners: Number(metrics?.totals?.owners ?? 0),
      },
      vendorRequests: {
        pending: Number(metrics?.vendorRequests?.pending ?? 0),
        approved: Number(metrics?.vendorRequests?.approved ?? 0),
      },
      products: {
        total: Number(metrics?.products?.total ?? 0),
        active: Number(metrics?.products?.active ?? 0),
      },
    },
    recentUsers,
    recentVendorRequests,
  }
}

interface OwnerDashboardLayoutProps {
  isLoading?: boolean
  isRedirecting?: boolean
  user?: { uid: string; role?: string } | null
  userProfile?: { role?: string } | null
}

export default function OwnerDashboardLayout({
  isLoading: externalLoading = false,
  isRedirecting: externalRedirecting = false,
}: OwnerDashboardLayoutProps = {}) {
  // Ensure all hooks are called unconditionally at the top level
  // This is critical to prevent React error #300 during rapid auth state changes
  // ALL hooks must be called before any conditional returns (Rules of Hooks)
  const { roleMeta, logout, loading: authLoading, userProfile, user } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<OwnerTab>('overview')
  const [analytics, setAnalytics] = useState<OwnerAnalyticsSnapshot | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [hasHydrated, setHasHydrated] = useState(false)

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true)
    try {
      // Wait for logout to complete (including server session clearing)
      await logout()
      
      // Small delay to ensure all state is cleared and server has processed the logout
      // This prevents redirect loops caused by stale session data
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Redirect to home page after logout, not back to /downtown
      // This prevents redirect loops and allows the user to access the main site
      // Use window.location.href for a full page reload to clear any stale state
      // This ensures a clean state and prevents any React state from persisting
      window.location.href = '/'
    } catch (error) {
      console.error('Logout failed:', error)
      // Even if logout fails, try to redirect to prevent being stuck
      // Clear any remaining state and do a hard redirect
      window.location.href = '/'
    }
    // Note: We don't set setIsLoggingOut(false) here because we're doing a full page reload
    // The component will unmount before this state update would matter
  }, [logout])

  const fetchAnalytics = useCallback(async () => {
    // Check cache first
    const cached = analyticsCache.get()
    const hadCache = Boolean(cached)
    
    if (cached) {
      setAnalytics(cached)
      setAnalyticsLoading(false)
      // Still fetch in background to refresh cache
      // But don't show loading state
    } else {
      setAnalyticsLoading(true)
    }
    
    setAnalyticsError(null)
    
    try {
      const response = await fetch('/api/admin/analytics', { 
        credentials: 'include',
        // Add cache headers to prevent unnecessary requests
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to load analytics.')
      }
      
      const payload = await response.json()
      const adapted = adaptAnalytics(payload)
      
      setAnalytics(adapted)
      analyticsCache.set(adapted) // Cache after successful fetch
    } catch (requestError) {
      // If we have cached data, keep showing it (don't show error)
      if (!hadCache) {
        setAnalyticsError(
          requestError instanceof Error ? requestError.message : 'Unable to load analytics.',
        )
      }
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  // CRITICAL: Hydrate from session cache AND route cache on mount
  useEffect(() => {
    setIsMounted(true)
    
    // Check for cached route first - if exists, we can skip skeleton
    if (typeof window !== 'undefined') {
      try {
        const cachedRoute = sessionStorage.getItem('echoshop_route_cache')
        if (cachedRoute) {
          const routeData = JSON.parse(cachedRoute)
          if (routeData.timestamp && Date.now() - routeData.timestamp < 30000) {
            // Route cache exists and is fresh - mark as hydrated immediately
            setHasHydrated(true)
            return
          }
        }
        
        // Also check session cache
        const cached = sessionStorage.getItem('echoshop_session_cache')
        if (cached) {
          const data = JSON.parse(cached)
          if (data.timestamp && Date.now() - data.timestamp < 300000 && roleMeta) {
            setHasHydrated(true)
            return
          }
        }
      } catch {
        // Ignore cache errors
      }
    }
  }, [])

  // Mark as hydrated once we have roleMeta (even if from cache)
  useEffect(() => {
    if (roleMeta && !hasHydrated) {
      setHasHydrated(true)
    }
  }, [roleMeta, hasHydrated])

  // Only fetch analytics when not loading, not redirecting, and auth is ready
  // This prevents unnecessary API calls and state updates during auth transitions
  useEffect(() => {
    if (!externalLoading && !externalRedirecting && !authLoading) {
      fetchAnalytics()
    }
  }, [fetchAnalytics, externalLoading, externalRedirecting, authLoading])

  const headerDescription = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return 'Monitor the system pulse across users, vendors, and content.'
      case 'users':
        return 'Manage end-user access levels and handle escalations.'
      case 'vendors':
        return 'Oversee marketplace vendors and keep their profiles current.'
      case 'requests':
        return 'Approve or reject vendor onboarding requests.'
      case 'invitations':
        return 'Invite trusted teammates to help operate the platform.'
      case 'analytics':
        return 'Dive deeper into engagement trends and recent activity.'
      case 'health':
        return 'Monitor vendor health scores and trustworthiness metrics.'
      case 'payouts':
        return 'Manage vendor payouts, holds, and financial compliance.'
      case 'activity':
        return 'Real-time monitoring of vendor activities and actions.'
      case 'audit':
        return 'GDPR-compliant audit log of all admin actions.'
      case 'features':
        return 'Control features without code changes using feature flags.'
      default:
        return ''
    }
  }, [activeTab])

  const quickActions = useMemo(
    () => [
      {
        key: 'requests',
        icon: Inbox,
        title: 'Review vendor requests',
        description: 'Approve or decline pending vendor applications.',
        tab: 'requests' as const,
      },
      {
        key: 'analytics',
        icon: BarChart3,
        title: 'Monitor marketplace health',
        description: 'Track growth, conversions, and moderation activity.',
        tab: 'analytics' as const,
      },
      {
        key: 'users',
        icon: Users,
        title: 'Manage team roles',
        description: 'Adjust permissions and respond to escalations quickly.',
        tab: 'users' as const,
      },
    ],
    [],
  )

  // Check for cached route FIRST - if exists, skip skeleton entirely
  const hasValidCachedRoute = Boolean(
    typeof window !== 'undefined' &&
    sessionStorage.getItem('echoshop_route_cache')
  )

  // Show skeleton ONLY if:
  // 1. Initial mount when auth is loading AND no cache exists
  // 2. External loading is requested
  // 3. Redirecting
  // This prevents skeleton on tab return/refresh when cache exists
  const shouldShowSkeleton =
    // Only show on initial mount when auth is loading AND no cache exists
    (!isMounted && authLoading && !hasValidCachedRoute) ||
    // External loading/redirecting flags
    externalLoading ||
    externalRedirecting

  if (shouldShowSkeleton) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4" />
          <p className="text-gray-600">
            {externalRedirecting ? 'Redirecting...' : 'Loading dashboard...'}
          </p>
        </div>
      </div>
    )
  }

  // CRITICAL FIX: If we have user/profile with owner role, render even if roleMeta not set yet
  // This prevents blocking on refresh when roleMeta is still loading
  const hasOwnerRole = userProfile?.role === 'owner' || user?.role === 'owner'
  
  // If we have roleMeta, we're ready - render dashboard
  // OR if we have owner role from user/profile, render (roleMeta will catch up)
  // This prevents skeleton on tab return/refresh
  if (!roleMeta && !hasOwnerRole) {
    // No roleMeta and no owner role - might be loading or auth failed
    // If auth is loading, show skeleton (handled above)
    // If auth is not loading, return null (auth failed)
    if (!authLoading) {
      return null
    }
    // Still loading - skeleton already handled above
    return null
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <SystemStatusOverview
            analytics={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            onRetry={fetchAnalytics}
          />
        )
      case 'users':
        return <UserManagement />
      case 'vendors':
        return <VendorManagement />
      case 'requests':
        return <VendorRequestsPanel defaultStatus="pending" />
      case 'support':
        return <OwnerSupportTickets />
      case 'invitations':
        return <OwnerInvitations />
      case 'analytics':
        return (
          <SystemAnalytics
            analytics={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            onRetry={fetchAnalytics}
          />
        )
      case 'health':
        return <VendorHealthScoring />
      case 'payouts':
        return <PayoutManagement />
      case 'activity':
        return <ActivityFeed />
      case 'audit':
        return <AuditLogViewer />
      case 'features':
        return <FeatureFlagsPanel />
      case 'security':
        return <OwnerSecuritySettings />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <Card
        data-tour="owner-welcome-card"
        className="border-slate-200 bg-slate-50/80 backdrop-blur-sm"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            {roleMeta?.welcomeTitle ?? 'Owner Console'}
          </CardTitle>
          <CardDescription className="text-sm text-slate-700">
            {roleMeta?.welcomeSubtitle ?? 'Manage your platform'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <div
              key={action.key}
              data-tour={`owner-action-${action.key}`}
              className="flex h-full flex-col justify-between rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm"
            >
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-slate-800">
                  <action.icon className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold">{action.title}</span>
                </div>
                <p className="text-sm text-slate-700">{action.description}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-3 w-fit px-0 text-purple-700 hover:text-purple-900"
                onClick={() => setActiveTab(action.tab)}
              >
                Jump to tab →
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Downtown owner console</h1>
            {headerDescription ? (
              <p className="text-sm text-slate-600">{headerDescription}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <AlertCenter />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab.key)}
              data-tour={`owner-tab-${tab.key}`}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Button>
          )
        })}
      </div>

      <section className={cn('space-y-6', activeTab === 'overview' ? 'mt-4' : 'mt-2')}>
        {renderContent()}
      </section>
    </div>
  )
}
