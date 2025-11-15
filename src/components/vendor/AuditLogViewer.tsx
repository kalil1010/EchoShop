'use client'

import React, { useState, useEffect } from 'react'
import { Activity, Clock, User, Shield, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface AuditLogEntry {
  id: string
  action: string
  resource: string
  userId: string
  timestamp: string
  ipAddress?: string
  userAgent?: string
  status: 'success' | 'failure' | 'warning'
  details?: Record<string, unknown>
}

interface AuditLogViewerProps {
  vendorId?: string
  limit?: number
  apiPrefix?: string // e.g., '/api/vendor' or '/api/admin'
}

export default function AuditLogViewer({ vendorId, limit = 50, apiPrefix = '/api/vendor' }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLogs = async () => {
      if (!vendorId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`${apiPrefix}/security/audit-logs?limit=${limit}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to load audit logs')
        }

        const data = await response.json()
        setLogs(data.logs || [])
      } catch (err) {
        console.error('Failed to fetch audit logs:', err)
        setError(err instanceof Error ? err.message : 'Failed to load audit logs')
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [vendorId, limit])

  const getStatusIcon = (status: AuditLogEntry['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 animate-pulse opacity-50" />
        Loading activity log...
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-600" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No activity logs found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-muted/50"
        >
          <div className="mt-0.5 flex-shrink-0">{getStatusIcon(log.status)}</div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{log.action}</span>
              {log.resource && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {log.resource}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimestamp(log.timestamp)}
              </span>
              {log.ipAddress && (
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {log.ipAddress}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

