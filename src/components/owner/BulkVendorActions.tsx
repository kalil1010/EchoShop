'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { UserCheck, UserX, Ban, CheckCircle } from 'lucide-react'

interface BulkVendorActionsProps {
  vendorIds: string[]
  onSuccess: () => void
}

export function BulkVendorActions({ vendorIds, onSuccess }: BulkVendorActionsProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<string | null>(null)

  const handleBulkAction = async (actionType: string) => {
    if (vendorIds.length === 0) return

    setLoading(true)
    setAction(actionType)
    try {
      const response = await fetch('/api/admin/bulk/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          vendor_ids: vendorIds,
          action: actionType,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `Failed to ${actionType} vendors`)
      }

      toast({
        title: 'Success',
        description: `${vendorIds.length} vendors ${actionType}d`,
        variant: 'success',
      })

      onSuccess()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${actionType} vendors`,
        variant: 'error',
      })
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Vendor Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">
          {vendorIds.length} vendor(s) selected
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => handleBulkAction('suspend')}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Ban className="h-4 w-4" />
            Suspend
          </Button>
          <Button
            variant="outline"
            onClick={() => handleBulkAction('activate')}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Activate
          </Button>
        </div>
        {loading && action && (
          <p className="text-sm text-gray-500 mt-2">
            {action === 'suspend' ? 'Suspending...' : 'Activating...'} vendors
          </p>
        )}
      </CardContent>
    </Card>
  )
}

