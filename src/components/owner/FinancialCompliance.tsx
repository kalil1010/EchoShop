'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react'

interface VendorCompliance {
  vendor_id: string
  vendor_name?: string
  vendor_email?: string
  kyc_verified: boolean
  tax_docs_verified: boolean
  compliance_status: 'pending' | 'verified' | 'rejected' | 'expired'
  compliance_notes?: string
  last_verified_at?: string
}

export function FinancialCompliance() {
  const { toast } = useToast()
  const [vendors, setVendors] = useState<VendorCompliance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCompliance()
  }, [])

  const fetchCompliance = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/payouts/compliance', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load compliance data')
      }

      const data = await response.json()
      setVendors(data.vendors || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load compliance data')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCompliance = async (
    vendorId: string,
    kycVerified: boolean,
    taxDocsVerified: boolean,
    status: string,
    notes?: string
  ) => {
    try {
      const response = await fetch(`/api/admin/payouts/compliance/${vendorId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kyc_verified: kycVerified,
          tax_docs_verified: taxDocsVerified,
          compliance_status: status,
          compliance_notes: notes,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update compliance')
      }

      toast({
        title: 'Success',
        description: 'Compliance status updated',
        variant: 'success',
      })

      fetchCompliance()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update compliance',
        variant: 'error',
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'expired':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Compliance</CardTitle>
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
        ) : vendors.length === 0 ? (
          <p className="text-sm text-gray-600">No vendors found</p>
        ) : (
          <div className="space-y-3">
            {vendors.map((vendor) => (
              <div
                key={vendor.vendor_id}
                className="rounded-md border border-slate-200 p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {vendor.vendor_name || vendor.vendor_email || vendor.vendor_id}
                      </span>
                      <Badge className={getStatusColor(vendor.compliance_status)}>
                        {vendor.compliance_status}
                      </Badge>
                    </div>
                    <div className="flex gap-4 mt-2 text-sm">
                      <div className="flex items-center gap-1">
                        {vendor.kyc_verified ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={vendor.kyc_verified ? 'text-green-600' : 'text-red-600'}>
                          KYC {vendor.kyc_verified ? 'Verified' : 'Not Verified'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {vendor.tax_docs_verified ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={vendor.tax_docs_verified ? 'text-green-600' : 'text-red-600'}>
                          Tax Docs {vendor.tax_docs_verified ? 'Verified' : 'Not Verified'}
                        </span>
                      </div>
                    </div>
                    {vendor.compliance_notes && (
                      <p className="text-xs text-gray-600 mt-2">{vendor.compliance_notes}</p>
                    )}
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

