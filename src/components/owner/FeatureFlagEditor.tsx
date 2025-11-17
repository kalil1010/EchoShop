'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

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
}

interface FeatureFlagEditorProps {
  flag: FeatureFlag | null
  open: boolean
  onClose: () => void
}

export function FeatureFlagEditor({ flag, open, onClose }: FeatureFlagEditorProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    flag_key: '',
    flag_name: '',
    description: '',
    is_enabled: false,
    is_global: true,
    rollout_percentage: 100,
    scheduled_enable_at: '',
    scheduled_disable_at: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (flag) {
      setFormData({
        flag_key: flag.flag_key,
        flag_name: flag.flag_name,
        description: flag.description || '',
        is_enabled: flag.is_enabled,
        is_global: flag.is_global,
        rollout_percentage: flag.rollout_percentage,
        scheduled_enable_at: flag.scheduled_enable_at 
          ? new Date(flag.scheduled_enable_at).toISOString().slice(0, 16)
          : '',
        scheduled_disable_at: flag.scheduled_disable_at
          ? new Date(flag.scheduled_disable_at).toISOString().slice(0, 16)
          : '',
      })
    } else {
      setFormData({
        flag_key: '',
        flag_name: '',
        description: '',
        is_enabled: false,
        is_global: true,
        rollout_percentage: 100,
        scheduled_enable_at: '',
        scheduled_disable_at: '',
      })
    }
  }, [flag])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.flag_key || !formData.flag_name) {
      toast({
        title: 'Error',
        description: 'Flag key and name are required',
        variant: 'error',
      })
      return
    }

    setLoading(true)
    try {
      const url = flag 
        ? `/api/admin/feature-flags/${flag.id}`
        : '/api/admin/feature-flags'
      
      const method = flag ? 'PATCH' : 'POST'

      const payload = {
        flag_key: formData.flag_key,
        flag_name: formData.flag_name,
        description: formData.description || null,
        is_enabled: formData.is_enabled,
        is_global: formData.is_global,
        rollout_percentage: formData.rollout_percentage,
        scheduled_enable_at: formData.scheduled_enable_at || null,
        scheduled_disable_at: formData.scheduled_disable_at || null,
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save feature flag')
      }

      toast({
        title: 'Success',
        description: flag ? 'Feature flag updated' : 'Feature flag created',
        variant: 'success',
      })

      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save feature flag',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{flag ? 'Edit Feature Flag' : 'Create Feature Flag'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="flag_key" className="block text-sm font-medium text-gray-700 mb-1">
                Flag Key *
              </label>
              <Input
                id="flag_key"
                value={formData.flag_key}
                onChange={(e) => setFormData({ ...formData, flag_key: e.target.value })}
                placeholder="e.g., bulk_upload"
                required
                disabled={!!flag} // Can't change key after creation
              />
              <p className="text-xs text-gray-500 mt-1">
                Unique identifier (lowercase, underscores only)
              </p>
            </div>

            <div>
              <label htmlFor="flag_name" className="block text-sm font-medium text-gray-700 mb-1">
                Flag Name *
              </label>
              <Input
                id="flag_name"
                value={formData.flag_name}
                onChange={(e) => setFormData({ ...formData, flag_name: e.target.value })}
                placeholder="e.g., Bulk Upload Feature"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                placeholder="Describe what this feature flag controls..."
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_enabled}
                  onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Enabled</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_global}
                  onChange={(e) => setFormData({ ...formData, is_global: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Global (applies to all vendors)</span>
              </label>
            </div>

            {formData.is_global && (
              <div>
                <label htmlFor="rollout_percentage" className="block text-sm font-medium text-gray-700 mb-1">
                  Rollout Percentage (0-100)
                </label>
                <Input
                  id="rollout_percentage"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.rollout_percentage}
                  onChange={(e) => setFormData({ ...formData, rollout_percentage: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Percentage of vendors/users who should have this feature enabled (for A/B testing)
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="scheduled_enable_at" className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Enable At
                </label>
                <Input
                  id="scheduled_enable_at"
                  type="datetime-local"
                  value={formData.scheduled_enable_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_enable_at: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="scheduled_disable_at" className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Disable At
                </label>
                <Input
                  id="scheduled_disable_at"
                  type="datetime-local"
                  value={formData.scheduled_disable_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_disable_at: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : flag ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

