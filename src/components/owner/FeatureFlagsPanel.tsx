'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { FeatureFlagEditor } from './FeatureFlagEditor'
import { Toggle, Plus, Calendar, Globe, User } from 'lucide-react'

interface FeatureFlag {
  id: string
  flag_key: string
  flag_name: string
  description: string | null
  is_enabled: boolean
  is_global: boolean
  rollout_percentage: number
  scheduled_enable_at: string | null
  scheduled_disable_at: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export function FeatureFlagsPanel() {
  const { toast } = useToast()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchFlags = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/feature-flags', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load feature flags')
      }

      const data = await response.json()
      setFlags(data.flags || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature flags')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFlags()
  }, [fetchFlags])

  const handleToggle = async (flag: FeatureFlag) => {
    setTogglingId(flag.id)
    try {
      const response = await fetch(`/api/admin/feature-flags/${flag.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !flag.is_enabled }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle feature flag')
      }

      toast({
        title: 'Success',
        description: `Feature flag ${!flag.is_enabled ? 'enabled' : 'disabled'}`,
        variant: 'success',
      })

      fetchFlags()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to toggle feature flag',
        variant: 'error',
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleEdit = (flag: FeatureFlag) => {
    setSelectedFlag(flag)
    setShowEditor(true)
  }

  const handleCreate = () => {
    setSelectedFlag(null)
    setShowEditor(true)
  }

  const handleEditorClose = () => {
    setShowEditor(false)
    setSelectedFlag(null)
    fetchFlags()
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Feature Flags</CardTitle>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Flag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : flags.length === 0 ? (
            <p className="text-sm text-gray-600">No feature flags found</p>
          ) : (
            <div className="space-y-3">
              {flags.map((flag) => (
                <div
                  key={flag.id}
                  className="rounded-md border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{flag.flag_name}</span>
                        <Badge className={flag.is_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {flag.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        {flag.is_global ? (
                          <Badge className="bg-blue-100 text-blue-800">
                            <Globe className="h-3 w-3 mr-1" />
                            Global
                          </Badge>
                        ) : (
                          <Badge className="bg-purple-100 text-purple-800">
                            <User className="h-3 w-3 mr-1" />
                            Per-Vendor
                          </Badge>
                        )}
                        {flag.rollout_percentage < 100 && (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            {flag.rollout_percentage}% Rollout
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{flag.description || flag.flag_key}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Key: <code className="bg-gray-100 px-1 rounded">{flag.flag_key}</code></span>
                        {flag.scheduled_enable_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Enable: {formatDate(flag.scheduled_enable_at)}
                          </span>
                        )}
                        {flag.scheduled_disable_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Disable: {formatDate(flag.scheduled_disable_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(flag)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle(flag)}
                        disabled={togglingId === flag.id}
                      >
                        <Toggle className="h-4 w-4 mr-1" />
                        {togglingId === flag.id ? 'Toggling...' : flag.is_enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showEditor && (
        <FeatureFlagEditor
          flag={selectedFlag}
          open={showEditor}
          onClose={handleEditorClose}
        />
      )}
    </div>
  )
}

