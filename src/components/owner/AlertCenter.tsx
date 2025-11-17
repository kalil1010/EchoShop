'use client'

import React, { useState, useEffect } from 'react'
import { Bell, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

interface Alert {
  id: string
  rule_id: string
  alert_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  vendor_id: string | null
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed'
  created_at: string
}

export function AlertCenter() {
  const { toast } = useToast()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAlerts()
    // Poll for new alerts every 30 seconds
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/alerts?status=open&limit=10', {
        credentials: 'include',
      })

      if (!response.ok) return

      const data = await response.json()
      setAlerts(data.alerts || [])
      setUnreadCount(data.alerts?.filter((a: Alert) => a.status === 'open').length || 0)
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/resolve`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to resolve alert')
      }

      toast({
        title: 'Success',
        description: 'Alert resolved',
        variant: 'success',
      })

      fetchAlerts()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resolve alert',
        variant: 'error',
      })
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return AlertCircle
      case 'high':
        return AlertTriangle
      case 'medium':
        return Info
      default:
        return Info
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <Card className="absolute right-0 top-12 z-50 w-96 max-h-[600px] overflow-y-auto shadow-lg">
            <CardContent className="p-0">
              <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-semibold">Alerts</h3>
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="divide-y">
                {loading ? (
                  <div className="p-4 text-sm text-gray-500">Loading...</div>
                ) : alerts.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No alerts</div>
                ) : (
                  alerts.map((alert) => {
                    const Icon = getSeverityIcon(alert.severity)
                    return (
                      <div
                        key={alert.id}
                        className={`p-4 border-l-4 ${getSeverityColor(alert.severity)}`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <Icon className="h-5 w-5 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm">{alert.title}</span>
                              <Badge className={getSeverityColor(alert.severity)}>
                                {alert.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-700">{alert.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(alert.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolve(alert.id)}
                            className="text-xs"
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

