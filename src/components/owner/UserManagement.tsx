'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { normaliseRole } from '@/lib/roles'
import { VendorHealthBadge } from './VendorHealthBadge'
import type { OwnerUserRecord } from './types'
import type { UserRole } from '@/types/user'
import type { VendorHealthStatus } from '@/lib/vendorHealthCalculation'

type RoleFilter = 'all' | 'user' | 'vendor' | 'owner'

interface UserManagementProps {
  heading?: string
  description?: string
  roleFilter?: RoleFilter
  emptyStateMessage?: string
}

const ROLE_LABELS: Record<UserRole, string> = {
  user: 'User',
  vendor: 'Vendor',
  owner: 'Owner',
  admin: 'Owner',
}

type ManagedRole = 'user' | 'vendor' | 'owner'

const ROLE_OPTIONS: Array<{ value: ManagedRole; label: string }> = [
  { value: 'user', label: 'User' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'owner', label: 'Owner' },
]

const resolveManagedRole = (value: string | null | undefined): ManagedRole => {
  const resolved = normaliseRole(value)
  return resolved === 'admin' ? 'owner' : resolved
}

interface VendorHealthData {
  vendor_id: string
  overall_score: number
  status: VendorHealthStatus
}

export default function UserManagement({
  heading = 'User management',
  description = 'Review accounts and adjust their platform roles.',
  roleFilter = 'all',
  emptyStateMessage = 'No users match this filter yet.',
}: UserManagementProps) {
  const { toast } = useToast()
  const [users, setUsers] = useState<OwnerUserRecord[]>([])
  const [healthScores, setHealthScores] = useState<Record<string, VendorHealthData>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'health_score'>('name')
  const [filterStatus, setFilterStatus] = useState<VendorHealthStatus | ''>('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (roleFilter !== 'all') {
        params.set('role', roleFilter)
      }
      const query = params.toString()
      const response = await fetch(`/api/admin/users${query ? `?${query}` : ''}`, {
        credentials: 'include',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to load users.')
      }
      const payload = await response.json()
      const list: OwnerUserRecord[] = Array.isArray(payload?.users) ? payload.users : []
      setUsers(list)

      // Fetch health scores for vendors
      if (roleFilter === 'vendor' || roleFilter === 'all') {
        const vendorIds = list.filter(u => resolveManagedRole(u.role) === 'vendor').map(u => u.id)
        if (vendorIds.length > 0) {
          try {
            const healthPromises = vendorIds.map(async (id) => {
              const healthResponse = await fetch(`/api/admin/vendor-health/${id}`, {
                credentials: 'include',
              })
              if (healthResponse.ok) {
                const healthData = await healthResponse.json()
                return healthData ? { vendor_id: id, ...healthData } : null
              }
              return null
            })
            const healthResults = await Promise.all(healthPromises)
            const healthMap: Record<string, VendorHealthData> = {}
            healthResults.forEach((result) => {
              if (result) {
                healthMap[result.vendor_id] = result
              }
            })
            setHealthScores(healthMap)
          } catch (err) {
            console.error('Failed to fetch health scores:', err)
            // Don't fail the whole request if health scores fail
          }
        }
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load users.')
    } finally {
      setLoading(false)
    }
  }, [roleFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const displayedUsers = useMemo(() => {
    let filtered = users

    // Filter by search term
    if (searchTerm) {
      const query = searchTerm.toLowerCase()
      filtered = filtered.filter((user) => {
        const candidate = `${user.displayName ?? ''} ${user.email ?? ''} ${user.vendorBusinessName ?? ''}`.toLowerCase()
        return candidate.includes(query)
      })
    }

    // Filter by health status (for vendors only)
    if (filterStatus && (roleFilter === 'vendor' || roleFilter === 'all')) {
      filtered = filtered.filter((user) => {
        if (resolveManagedRole(user.role) !== 'vendor') return true
        const health = healthScores[user.id]
        return health?.status === filterStatus
      })
    }

    // Sort
    if (sortBy === 'health_score' && (roleFilter === 'vendor' || roleFilter === 'all')) {
      filtered = [...filtered].sort((a, b) => {
        const healthA = healthScores[a.id]?.overall_score ?? 0
        const healthB = healthScores[b.id]?.overall_score ?? 0
        return healthB - healthA // Descending
      })
    } else {
      filtered = [...filtered].sort((a, b) => {
        const nameA = (a.displayName ?? a.email ?? '').toLowerCase()
        const nameB = (b.displayName ?? b.email ?? '').toLowerCase()
        return nameA.localeCompare(nameB)
      })
    }

    return filtered
  }, [users, searchTerm, sortBy, filterStatus, healthScores, roleFilter])

  const handleRoleChange = async (user: OwnerUserRecord, nextRole: ManagedRole) => {
    if (user.id === updatingUserId || resolveManagedRole(user.role) === nextRole) {
      return
    }

    setUpdatingUserId(user.id)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          role: nextRole,
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Unable to update user role.')
      }
      const payload = await response.json()
      const updated: OwnerUserRecord | null =
        payload?.user && typeof payload.user === 'object' ? payload.user : null
      if (updated) {
        setUsers((previous) =>
          previous.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
        )
        toast({
          title: 'Role updated',
          description: `${updated.displayName ?? updated.email ?? 'User'} is now ${ROLE_LABELS[normaliseRole(updated.role)]}.`,
        })
      } else {
        await fetchUsers()
      }
    } catch (requestError) {
      toast({
        title: 'Unable to update role',
        description:
          requestError instanceof Error ? requestError.message : 'Please try again later.',
        variant: 'error',
      })
    } finally {
      setUpdatingUserId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">{heading}</CardTitle>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            placeholder="Search by name, email, or business..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="md:max-w-sm"
          />
          <div className="flex gap-2">
            {(roleFilter === 'vendor' || roleFilter === 'all') && (
              <>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'health_score')}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="name">Sort by Name</option>
                  <option value="health_score">Sort by Health Score</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as VendorHealthStatus | '')}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="">All Vendors</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="warning">At Risk</option>
                  <option value="critical">Critical</option>
                </select>
              </>
            )}
            <Button variant="outline" onClick={fetchUsers} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm text-rose-600">{error}</p>
            <Button variant="outline" onClick={fetchUsers}>
              Retry
            </Button>
          </div>
        ) : displayedUsers.length === 0 ? (
          <p className="text-sm text-slate-600">{emptyStateMessage}</p>
        ) : (
          <div className="space-y-3">
            {displayedUsers.map((user) => {
              const role = resolveManagedRole(user.role)
              const isLocked = user.isSuperAdmin
              return (
                <div
                  key={user.id}
                  className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[2fr,1fr,auto,auto]"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {user.displayName ?? user.email ?? 'Unknown user'}
                    </p>
                    <p className="text-xs text-slate-500">{user.email ?? 'No email on file'}</p>
                    {user.vendorBusinessName ? (
                      <p className="text-xs text-slate-500">
                        Business: {user.vendorBusinessName}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Role</p>
                    <p
                        className={cn(
                          'text-sm font-semibold',
                          role === 'owner'
                            ? 'text-purple-600'
                            : role === 'vendor'
                              ? 'text-emerald-600'
                              : 'text-slate-600',
                        )}
                    >
                      {ROLE_LABELS[role]}
                      {user.isSuperAdmin ? ' • Super admin' : ''}
                    </p>
                  </div>
                  {role === 'vendor' && healthScores[user.id] && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Health</p>
                      <VendorHealthBadge
                        score={healthScores[user.id].overall_score}
                        status={healthScores[user.id].status}
                        showLabel={false}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`role-${user.id}`}>
                      Change role
                    </label>
                    <select
                      id={`role-${user.id}`}
                      className="w-36 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                      value={role}
                      onChange={(event) => {
                        const nextRole = event.target.value as ManagedRole
                        if (!ROLE_OPTIONS.some((option) => option.value === nextRole)) {
                          return
                        }
                        void handleRoleChange(user, nextRole)
                      }}
                      disabled={isLocked || updatingUserId === user.id}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {isLocked ? (
                      <span className="text-xs text-slate-500">Locked</span>
                    ) : updatingUserId === user.id ? (
                      <span className="text-xs text-slate-500">Updating...</span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
