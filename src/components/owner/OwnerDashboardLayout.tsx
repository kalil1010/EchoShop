'use client'

import React, { useCallback, useEffect, useMemo, useState, memo } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Inbox, BarChart3, Users, LogOut, Shield } from 'lucide-react'

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
import type { OwnerAnalyticsSnapshot } from './types'

type OwnerTab =
  | 'overview'
  | 'users'
  | 'vendors'
  | 'requests'
  | 'invitations'
  | 'analytics'
  | 'security'

const TABS: Array<{ key: OwnerTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'requests', label: 'Vendor Requests' },
  { key: 'invitations', label: 'Invitations' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'security', label: 'Security' },
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
  const { roleMeta, logout, loading: authLoading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<OwnerTab>('overview')
  const [analytics, setAnalytics] = useState<OwnerAnalyticsSnapshot | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    try {
      const response = await fetch('/api/admin/analytics', { credentials: 'include' })
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

  // Show loading/redirecting state if auth is still loading, external loading is requested, or redirecting
  // roleMeta is always defined (computed in useMemo with fallbacks), so no need to check it
  // This must come AFTER all hooks are called to prevent React error #300
  if (authLoading || externalLoading || externalRedirecting) {
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
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.key)}
            data-tour={`owner-tab-${tab.key}`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <section className={cn('space-y-6', activeTab === 'overview' ? 'mt-4' : 'mt-2')}>
        {renderContent()}
      </section>
    </div>
  )
}
