'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { OwnerUserRecord } from './types'

type RoleFilter = 'all' | 'user' | 'vendor' | 'owner'

interface UserManagementProps {
  heading?: string
  description?: string
  roleFilter?: RoleFilter
  emptyStateMessage?: string
}

const ROLE_LABELS: Record<string, string> = {
  user: 'User',
  vendor: 'Vendor',
  owner: 'Owner',
}

const ROLE_OPTIONS: Array<{ value: 'user' | 'vendor' | 'owner'; label: string }> = [
  { value: 'user', label: 'User' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'owner', label: 'Owner' },
]

const normaliseRole = (value: string | null | undefined): 'user' | 'vendor' | 'owner' => {
  const key = (value ?? 'user').toLowerCase()
  if (key === 'vendor' || key === 'owner') return key
  return 'user'
}

export default function UserManagement({
  heading = 'User management',
  description = 'Review accounts and adjust their platform roles.',
  roleFilter = 'all',
  emptyStateMessage = 'No users match this filter yet.',
}: UserManagementProps) {
  const { toast } = useToast()
  const [users, setUsers] = useState<OwnerUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (roleFilter !== 'all') {
        params.set('role', roleFilter)
      }
      const query = params.toString()
      const response = await fetch(`/api/owner/users${query ? `?${query}` : ''}`, {
        credentials: 'include',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to load users.')
      }
      const payload = await response.json()
      const list: OwnerUserRecord[] = Array.isArray(payload?.users) ? payload.users : []
      setUsers(list)
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
    if (!searchTerm) return users
    const query = searchTerm.toLowerCase()
    return users.filter((user) => {
      const candidate = `${user.displayName ?? ''} ${user.email ?? ''} ${user.vendorBusinessName ?? ''}`.toLowerCase()
      return candidate.includes(query)
    })
  }, [users, searchTerm])

  const handleRoleChange = async (user: OwnerUserRecord, nextRole: 'user' | 'vendor' | 'owner') => {
    if (user.id === updatingUserId || normaliseRole(user.role) === nextRole) {
      return
    }

    setUpdatingUserId(user.id)
    try {
      const response = await fetch('/api/owner/users', {
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
              const role = normaliseRole(user.role)
              const isLocked = user.isSuperAdmin
              return (
                <div
                  key={user.id}
                  className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[2fr,1fr,auto]"
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
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`role-${user.id}`}>
                      Change role
                    </label>
                    <select
                      id={`role-${user.id}`}
                      className="w-36 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                      value={role}
                      onChange={(event) =>
                        handleRoleChange(user, event.target.value as 'user' | 'vendor' | 'admin')
                      }
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
