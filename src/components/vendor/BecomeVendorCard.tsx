'use client'

import React, { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'

interface BecomeVendorCardProps {
  headline?: string
}

export default function BecomeVendorCard({ headline }: BecomeVendorCardProps) {
  const [activating, setActivating] = useState(false)
  const { toast } = useToast()
  const { refreshProfile } = useAuth()

  const handleActivate = async () => {
    setActivating(true)
    try {
      const response = await fetch('/api/vendor/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'dashboard' }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Unable to activate vendor mode at the moment.'
        throw new Error(message)
      }

      await refreshProfile().catch((error) => {
        console.warn('Failed to refresh profile after vendor activation:', error)
      })

      toast({
        variant: 'success',
        title: 'Vendor tools unlocked',
        description: 'You now have access to the vendor dashboard.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Activation failed. Please try again later.'
      toast({ variant: 'error', title: 'Activation failed', description: message })
    } finally {
      setActivating(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{headline ?? 'Sell on ZMODA Marketplace'}</CardTitle>
        <CardDescription>
          Upload collections, highlight new arrivals, and reach style-conscious shoppers directly from your vendor
          dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          <li>Host unlimited listings with rich imagery and product storytelling.</li>
          <li>AI-powered moderation keeps your catalog compliant and brand-safe.</li>
          <li>Products appear across the ZMODA marketplace and recommendation experiences.</li>
        </ul>
        <Button onClick={handleActivate} disabled={activating}>
          {activating ? 'Activating…' : 'Activate vendor account'}
        </Button>
      </CardContent>
    </Card>
  )
}
