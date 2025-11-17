'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AuditLogFilters } from './AuditLogFilters'
import { Download, Eye, Clock } from 'lucide-react'

interface AuditLog {
  id: string
  admin_id: string
  admin_email: string | null
  admin_role: string | null
  action_type: string
  action_category: string
  description: string
  reason: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  target_entity_type: string | null
  target_entity_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

interface AuditStats {
  total_actions: number
  by_category: Record<string, number>
  by_type: Record<string, number>
  by_admin: Record<string, number>
  recent_actions: number
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    adminId: '',
    actionCategory: '',
    actionType: '',
    startDate: '',
    endDate: '',
  })
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.adminId) params.set('admin_id', filters.adminId)
      if (filters.actionCategory) params.set('category', filters.actionCategory)
      if (filters.actionType) params.set('type', filters.actionType)
      if (filters.startDate) params.set('start_date', filters.startDate)
      if (filters.endDate) params.set('end_date', filters.endDate)
      params.set('page', page.toString())
      params.set('limit', '50')

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load audit logs')
      }

      const data = await response.json()
      if (page === 1) {
        setLogs(data.logs || [])
      } else {
        setLogs((prev) => [...prev, ...(data.logs || [])])
      }
      setHasMore(data.has_more || false)
      setStats(data.stats || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value)
      })

      const response = await fetch(`/api/admin/audit-logs/export?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to export audit logs')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString()}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'user':
        return 'bg-blue-100 text-blue-800'
      case 'vendor':
        return 'bg-green-100 text-green-800'
      case 'product':
        return 'bg-purple-100 text-purple-800'
      case 'payout':
        return 'bg-yellow-100 text-yellow-800'
      case 'system':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_actions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Last 24h</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recent_actions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">By Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {Object.entries(stats.by_category || {}).map(([cat, count]) => (
                  <div key={cat} className="flex justify-between">
                    <span className="capitalize">{cat}:</span>
                    <span className="font-semibold">{count as number}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Top Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {Object.entries(stats.by_admin || {})
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 3)
                  .map(([admin, count]) => (
                    <div key={admin} className="flex justify-between">
                      <span className="truncate">{admin}:</span>
                      <span className="font-semibold">{count as number}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Audit Log</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchLogs()}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuditLogFilters filters={filters} onFiltersChange={setFilters} />

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {loading && page === 1 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-gray-600">No audit logs found</p>
          ) : (
            <>
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-md border border-slate-200 p-4 space-y-2 cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getCategoryColor(log.action_category)}>
                            {log.action_category}
                          </Badge>
                          <span className="text-sm font-semibold">{log.action_type.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-gray-500">
                            by {log.admin_email || log.admin_id}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900">{log.description}</p>
                        {log.reason && (
                          <p className="text-xs text-gray-600 mt-1">
                            <strong>Reason:</strong> {log.reason}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(log.created_at)}
                          </div>
                          {log.target_entity_type && log.target_entity_id && (
                            <span>
                              Target: {log.target_entity_type} ({log.target_entity_id.slice(0, 8)}...)
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Audit Log Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Action Details</h3>
                <div className="space-y-1 text-sm">
                  <div><strong>Type:</strong> {selectedLog.action_type}</div>
                  <div><strong>Category:</strong> {selectedLog.action_category}</div>
                  <div><strong>Description:</strong> {selectedLog.description}</div>
                  {selectedLog.reason && (
                    <div><strong>Reason:</strong> {selectedLog.reason}</div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Admin</h3>
                <div className="space-y-1 text-sm">
                  <div><strong>Email:</strong> {selectedLog.admin_email || 'N/A'}</div>
                  <div><strong>Role:</strong> {selectedLog.admin_role || 'N/A'}</div>
                </div>
              </div>

              {selectedLog.before_state && (
                <div>
                  <h3 className="font-semibold mb-2">Before State</h3>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.before_state, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.after_state && (
                <div>
                  <h3 className="font-semibold mb-2">After State</h3>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.after_state, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <h3 className="font-semibold mb-2">Metadata</h3>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Security</h3>
                <div className="space-y-1 text-sm">
                  <div><strong>IP Address:</strong> {selectedLog.ip_address || 'N/A'}</div>
                  <div><strong>User Agent:</strong> {selectedLog.user_agent || 'N/A'}</div>
                  <div><strong>Timestamp:</strong> {formatTime(selectedLog.created_at)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

