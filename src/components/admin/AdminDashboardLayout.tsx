'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import SystemStatusOverview from './SystemStatusOverview'
import UserManagement from './UserManagement'
import VendorRequestsPanel from './VendorRequestsPanel'
import VendorManagement from './VendorManagement'
import SystemAnalytics from './SystemAnalytics'
import AdminInvitations from './AdminInvitations'
import type { AdminAnalyticsSnapshot } from './types'

type AdminTab =
  | 'overview'
  | 'users'
  | 'vendors'
  | 'requests'
  | 'invitations'
  | 'analytics'

const TABS: Array<{ key: AdminTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'requests', label: 'Vendor Requests' },
  { key: 'invitations', label: 'Invitations' },
  { key: 'analytics', label: 'Analytics' },
]

const adaptAnalytics = (payload: any): AdminAnalyticsSnapshot => {
  const metrics = payload?.metrics ?? {}
  const recentUsers = Array.isArray(payload?.recentUsers)
    ? payload.recentUsers.map((user: any) => ({
        id: String(user?.id ?? ''),
        label: typeof user?.label === 'string' ? user.label : null,
        role: typeof user?.role === 'string' ? user.role : null,
        createdAt: typeof user?.created_at === 'string' ? user.created_at : null,
      }))
    : []
  const recentVendorRequests = Array.isArray(payload?.recentVendorRequests)
    ? payload.recentVendorRequests.map((item: any) => ({
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
        admins: Number(metrics?.totals?.admins ?? 0),
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

export default function AdminDashboardLayout() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [analytics, setAnalytics] = useState<AdminAnalyticsSnapshot | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

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

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

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
        return <AdminInvitations />
      case 'analytics':
        return (
          <SystemAnalytics
            analytics={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            onRetry={fetchAnalytics}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Admin control center</h1>
        {headerDescription ? (
          <p className="text-sm text-slate-600">{headerDescription}</p>
        ) : null}
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

      <section className={cn('space-y-6', activeTab === 'overview' ? 'mt-4' : 'mt-2')}>
        {renderContent()}
      </section>
    </div>
  )
}
