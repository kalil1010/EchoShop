'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import SystemOwnerVendorRequests from '@/components/vendor/SystemOwnerVendorRequests'
import type { AdminVendorRequest } from './types'

interface VendorRequestsPanelProps {
  defaultStatus?: 'pending' | 'approved' | 'rejected'
}

export default function VendorRequestsPanel({ defaultStatus }: VendorRequestsPanelProps) {
  const [requests, setRequests] = useState<AdminVendorRequest[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = defaultStatus ? `?status=${encodeURIComponent(defaultStatus)}` : ''
      const response = await fetch(`/api/admin/vendor-requests${query}`, {
        method: 'GET',
        credentials: 'include',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to load vendor requests.')
      }
      const payload = await response.json()
      const list: AdminVendorRequest[] = Array.isArray(payload?.requests) ? payload.requests : []
      setRequests(list)
      setRefreshKey((key) => key + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load vendor requests.')
    } finally {
      setLoading(false)
    }
  }, [defaultStatus])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  if (loading) {
    return (
      <Card className="animate-pulse bg-slate-100">
        <CardHeader>
          <CardTitle className="text-slate-500">Loading vendor requests...</CardTitle>
        </CardHeader>
        <CardContent className="h-40" />
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-rose-50 border-rose-200">
        <CardHeader>
          <CardTitle className="text-rose-700">Vendor requests unavailable</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-rose-600">{error}</p>
          <Button variant="outline" onClick={fetchRequests}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!requests || requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-700">
            No vendor applications yet
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Once creators submit their marketplace applications they will appear here for review.
        </CardContent>
      </Card>
    )
  }

  return <SystemOwnerVendorRequests key={refreshKey} initialRequests={requests} />
}
