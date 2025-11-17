'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { BulkModerationActions } from './BulkModerationActions'
import { CheckCircle, XCircle, Eye, Package } from 'lucide-react'

interface Product {
  id: string
  vendor_id: string
  title: string
  description: string
  price: number
  currency: string
  status: string
  primary_image_url: string | null
  moderation_status: string | null
  moderation_message: string | null
  moderation_reasons: string[] | null
  created_at: string
  vendor_name?: string
}

export function ProductModerationQueue() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>('pending_review')

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      params.set('limit', '50')

      const response = await fetch(`/api/admin/products/moderation?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load products')
      }

      const data = await response.json()
      setProducts(data.products || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleApprove = async (productId: string) => {
    try {
      const response = await fetch(`/api/admin/products/moderation/${productId}/approve`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to approve product')
      }

      toast({
        title: 'Success',
        description: 'Product approved',
        variant: 'success',
      })

      fetchProducts()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to approve product',
        variant: 'error',
      })
    }
  }

  const handleReject = async (productId: string, reason: string) => {
    try {
      const response = await fetch(`/api/admin/products/moderation/${productId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        throw new Error('Failed to reject product')
      }

      toast({
        title: 'Success',
        description: 'Product rejected',
        variant: 'success',
      })

      fetchProducts()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to reject product',
        variant: 'error',
      })
    }
  }

  const toggleSelection = (productId: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Product Moderation Queue</CardTitle>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm"
              >
                <option value="pending_review">Pending Review</option>
                <option value="rejected">Rejected</option>
                <option value="active">Active</option>
                <option value="all">All</option>
              </select>
              {selectedProducts.size > 0 && (
                <BulkModerationActions
                  productIds={Array.from(selectedProducts)}
                  onSuccess={() => {
                    setSelectedProducts(new Set())
                    fetchProducts()
                  }}
                />
              )}
              <Button variant="outline" size="sm" onClick={fetchProducts}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : products.length === 0 ? (
            <p className="text-sm text-gray-600">No products found</p>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="rounded-md border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.id)}
                      onChange={() => toggleSelection(product.id)}
                      className="mt-1"
                    />
                    {product.primary_image_url && (
                      <img
                        src={product.primary_image_url}
                        alt={product.title}
                        className="w-24 h-24 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{product.title}</span>
                        <Badge className={getStatusColor(product.status)}>
                          {product.status}
                        </Badge>
                        {product.moderation_reasons && product.moderation_reasons.length > 0 && (
                          <Badge className="bg-red-100 text-red-800">
                            {product.moderation_reasons.length} violations
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                      <p className="text-sm font-semibold mt-1">
                        {product.price.toLocaleString()} {product.currency}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Vendor: {product.vendor_name || product.vendor_id}
                      </p>
                      {product.moderation_message && (
                        <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                          <strong>Moderation Note:</strong> {product.moderation_message}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {product.status === 'pending_review' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(product.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const reason = prompt('Rejection reason:')
                              if (reason) handleReject(product.id, reason)
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

