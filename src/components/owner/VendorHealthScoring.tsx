'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { VendorHealthDetails } from './VendorHealthDetails'
import { RefreshCw, Search } from 'lucide-react'

export function VendorHealthScoring() {
  const { toast } = useToast()
  const [vendorId, setVendorId] = useState('')
  const [searchVendorId, setSearchVendorId] = useState('')
  const [recalculating, setRecalculating] = useState(false)

  const handleRecalculate = async () => {
    if (!vendorId) {
      toast({
        title: 'Error',
        description: 'Please enter a vendor ID',
        variant: 'error',
      })
      return
    }

    setRecalculating(true)
    try {
      const response = await fetch(`/api/admin/vendor-health/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vendorId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to recalculate health score')
      }

      toast({
        title: 'Success',
        description: 'Health score recalculated successfully',
        variant: 'success',
      })
      
      // Refresh the view if this vendor is currently displayed
      if (searchVendorId === vendorId) {
        setSearchVendorId('') // Reset to trigger refresh
        setTimeout(() => setSearchVendorId(vendorId), 100)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to recalculate',
        variant: 'error',
      })
    } finally {
      setRecalculating(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vendor Health Scoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter vendor ID to view health score"
              value={searchVendorId}
              onChange={(e) => setSearchVendorId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => setSearchVendorId(searchVendorId)}>
              <Search className="h-4 w-4 mr-2" />
              View
            </Button>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Input
              placeholder="Enter vendor ID to recalculate"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleRecalculate}
              disabled={recalculating || !vendorId}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
              {recalculating ? 'Recalculating...' : 'Recalculate'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchVendorId && (
        <VendorHealthDetails vendorId={searchVendorId} />
      )}
    </div>
  )
}

