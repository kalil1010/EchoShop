'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { Plus, Edit, Trash2 } from 'lucide-react'

interface AlertRule {
  id: string
  rule_name: string
  description: string | null
  rule_type: string
  conditions: Record<string, unknown>
  auto_action: string | null
  notification_recipients: string[]
  is_active: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
}

export function AlertRules() {
  const { toast } = useToast()
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/alerts/rules', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load alert rules')
      }

      const data = await response.json()
      setRules(data.rules || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alert rules')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (rule: AlertRule) => {
    try {
      const response = await fetch(`/api/admin/alerts/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !rule.is_active }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle rule')
      }

      toast({
        title: 'Success',
        description: `Rule ${!rule.is_active ? 'activated' : 'deactivated'}`,
        variant: 'success',
      })

      fetchRules()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to toggle rule',
        variant: 'error',
      })
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Alert Rules</CardTitle>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-gray-600">No alert rules found</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-md border border-slate-200 p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{rule.rule_name}</span>
                      <Badge className={getSeverityColor(rule.severity)}>
                        {rule.severity}
                      </Badge>
                      <Badge className={rule.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{rule.description || rule.rule_type}</p>
                    {rule.auto_action && (
                      <p className="text-xs text-gray-500 mt-1">
                        Auto-action: {rule.auto_action}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(rule)}
                    >
                      {rule.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

