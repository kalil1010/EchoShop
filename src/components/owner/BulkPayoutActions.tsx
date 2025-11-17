'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { DollarSign, Lock, Unlock } from 'lucide-react'

interface BulkPayoutActionsProps {
  payoutIds: string[]
  onSuccess: () => void
}

export function BulkPayoutActions({ payoutIds, onSuccess }: BulkPayoutActionsProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleBulkAction = async (action: 'hold' | 'release' | 'process') => {
    if (payoutIds.length === 0) return

    setLoading(true)
    try {
      const response = await fetch('/api/admin/bulk/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          payout_ids: payoutIds,
          action,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action} payouts`)
      }

      toast({
        title: 'Success',
        description: `${payoutIds.length} payouts ${action}ed`,
        variant: 'success',
      })

      onSuccess()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${action} payouts`,
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Payout Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">
          {payoutIds.length} payout(s) selected
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            onClick={() => handleBulkAction('hold')}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Lock className="h-4 w-4" />
            Hold
          </Button>
          <Button
            variant="outline"
            onClick={() => handleBulkAction('release')}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Unlock className="h-4 w-4" />
            Release
          </Button>
          <Button
            variant="outline"
            onClick={() => handleBulkAction('process')}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <DollarSign className="h-4 w-4" />
            Process
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

