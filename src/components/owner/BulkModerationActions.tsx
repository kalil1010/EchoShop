'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { CheckCircle, XCircle, Archive } from 'lucide-react'

interface BulkModerationActionsProps {
  productIds: string[]
  onSuccess: () => void
}

export function BulkModerationActions({ productIds, onSuccess }: BulkModerationActionsProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleBulkAction = async (action: 'approve' | 'reject' | 'archive') => {
    if (productIds.length === 0) return

    setLoading(true)
    try {
      const response = await fetch('/api/admin/products/moderation/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          product_ids: productIds,
          action,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action} products`)
      }

      toast({
        title: 'Success',
        description: `${productIds.length} products ${action}d`,
        variant: 'success',
      })

      onSuccess()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${action} products`,
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={() => handleBulkAction('approve')}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700"
      >
        <CheckCircle className="h-4 w-4 mr-1" />
        Approve {productIds.length}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => {
          const reason = prompt('Rejection reason:')
          if (reason) handleBulkAction('reject')
        }}
        disabled={loading}
      >
        <XCircle className="h-4 w-4 mr-1" />
        Reject {productIds.length}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleBulkAction('archive')}
        disabled={loading}
      >
        <Archive className="h-4 w-4 mr-1" />
        Archive {productIds.length}
      </Button>
    </div>
  )
}

