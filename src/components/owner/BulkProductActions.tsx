'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Package, Archive, Trash2 } from 'lucide-react'

interface BulkProductActionsProps {
  productIds: string[]
  onSuccess: () => void
}

export function BulkProductActions({ productIds, onSuccess }: BulkProductActionsProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleBulkAction = async (action: 'approve' | 'reject' | 'archive' | 'delete') => {
    if (productIds.length === 0) return

    setLoading(true)
    try {
      const response = await fetch('/api/admin/bulk/products', {
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
    <Card>
      <CardHeader>
        <CardTitle>Bulk Product Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">
          {productIds.length} product(s) selected
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => handleBulkAction('approve')}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Package className="h-4 w-4" />
            Approve
          </Button>
          <Button
            variant="outline"
            onClick={() => handleBulkAction('archive')}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

