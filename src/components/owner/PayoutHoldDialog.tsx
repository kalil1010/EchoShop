'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

interface Payout {
  id: string
  payout_number: string
  amount: number
  currency: string
}

interface PayoutHoldDialogProps {
  payout: Payout
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PayoutHoldDialog({ payout, open, onClose, onSuccess }: PayoutHoldDialogProps) {
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!reason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for holding the payout',
        variant: 'error',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/payouts/${payout.id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to hold payout')
      }

      toast({
        title: 'Success',
        description: 'Payout held successfully',
        variant: 'success',
      })

      setReason('')
      onSuccess()
      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to hold payout',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Hold Payout</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Payout: <strong>{payout.payout_number}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Amount: <strong>{payout.amount.toLocaleString()} {payout.currency}</strong>
              </p>
            </div>
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Hold
              </label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for holding this payout..."
                required
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Holding...' : 'Hold Payout'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

