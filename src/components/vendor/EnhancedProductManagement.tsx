'use client'

import React, { useState, useCallback, useMemo, useRef } from 'react'
import { 
  Edit2, Copy, Trash2, Archive, CheckCircle2, XCircle, AlertCircle, 
  Upload, Download, Filter, Search, MoreVertical, Eye, EyeOff,
  FileSpreadsheet, Loader2
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { VendorProduct, VendorProductStatus } from '@/types/vendor'
import EnhancedProductUpload from './EnhancedProductUpload'
import ProductEditDialog from './ProductEditDialog'

interface EnhancedProductManagementProps {
  products: VendorProduct[]
  vendorName: string
  onProductUpdated?: () => void
}

const STATUS_LABELS: Record<VendorProductStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  active: 'Active',
  rejected: 'Rejected',
  archived: 'Archived',
}

const STATUS_COLORS: Record<VendorProductStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_review: 'bg-amber-100 text-amber-700 border-amber-200',
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  archived: 'bg-gray-100 text-gray-600 border-gray-200',
}

const formatPrice = (price: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

export default function EnhancedProductManagement({ 
  products, 
  vendorName,
  onProductUpdated 
}: EnhancedProductManagementProps) {
  const { toast } = useToast()
  const [showUpload, setShowUpload] = useState(false)
  const [editingProduct, setEditingProduct] = useState<VendorProduct | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<VendorProductStatus | 'all'>('all')
  const [bulkImporting, setBulkImporting] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const bulkImportInputRef = useRef<HTMLInputElement>(null)

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = 
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || product.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [products, searchQuery, statusFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<VendorProductStatus, number> = {
      draft: 0,
      pending_review: 0,
      active: 0,
      rejected: 0,
      archived: 0,
    }
    products.forEach((p) => {
      counts[p.status] = (counts[p.status] || 0) + 1
    })
    return counts
  }, [products])

  const handleDuplicate = useCallback(async (product: VendorProduct) => {
    setProcessingIds((prev) => new Set(prev).add(product.id))
    try {
      // Create a duplicate by fetching the original product images and creating a new one
      // For now, we'll create a draft copy without images (vendor can add images later)
      const response = await fetch('/api/vendor/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duplicateFrom: product.id,
          title: `${product.title} (Copy)`,
          description: product.description,
          price: product.price,
          currency: product.currency,
          status: 'draft',
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to duplicate product')
      }

      toast({
        variant: 'success',
        title: 'Product duplicated',
        description: 'A draft copy has been created. You can edit and publish it.',
      })

      onProductUpdated?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to duplicate product'
      toast({
        variant: 'error',
        title: 'Duplication failed',
        description: message,
      })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
  }, [toast, onProductUpdated])

  const handleStatusChange = useCallback(async (productId: string, newStatus: VendorProductStatus) => {
    setProcessingIds((prev) => new Set(prev).add(productId))
    try {
      const response = await fetch(`/api/vendor/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to update status')
      }

      toast({
        variant: 'success',
        title: 'Status updated',
        description: `Product is now ${STATUS_LABELS[newStatus]}.`,
      })

      onProductUpdated?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update status'
      toast({
        variant: 'error',
        title: 'Update failed',
        description: message,
      })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }, [toast, onProductUpdated])

  const handleDelete = useCallback(async (productId: string) => {
    if (!window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return
    }

    setProcessingIds((prev) => new Set(prev).add(productId))
    try {
      const response = await fetch(`/api/vendor/products/${productId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to delete product')
      }

      toast({
        variant: 'success',
        title: 'Product deleted',
        description: 'The product has been permanently removed.',
      })

      onProductUpdated?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete product'
      toast({
        variant: 'error',
        title: 'Delete failed',
        description: message,
      })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }, [toast, onProductUpdated])

  const handleBulkImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      toast({
        variant: 'error',
        title: 'Invalid file type',
        description: 'Please upload a CSV or Excel file.',
      })
      return
    }

    setBulkImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/vendor/products/bulk-import', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to import products')
      }

      const payload = await response.json()
      toast({
        variant: 'success',
        title: 'Import successful',
        description: `${payload.imported ?? 0} products imported successfully.`,
      })

      onProductUpdated?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import products'
      toast({
        variant: 'error',
        title: 'Import failed',
        description: message,
      })
    } finally {
      setBulkImporting(false)
      if (event.target) {
        event.target.value = ''
      }
    }
  }, [toast, onProductUpdated])

  const handleExport = useCallback(() => {
    const csv = [
      ['Title', 'Description', 'Price', 'Currency', 'Status', 'Created At'].join(','),
      ...products.map((p) =>
        [
          `"${p.title.replace(/"/g, '""')}"`,
          `"${(p.description || '').replace(/"/g, '""')}"`,
          p.price,
          p.currency,
          p.status,
          p.createdAt.toISOString(),
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      variant: 'success',
      title: 'Export completed',
      description: 'Your products have been exported to CSV.',
    })
  }, [products, toast])

  if (showUpload) {
    return (
      <EnhancedProductUpload
        onProductCreated={(product) => {
          setShowUpload(false)
          onProductUpdated?.()
        }}
        onCancel={() => setShowUpload(false)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Product Management</h2>
          <p className="text-sm text-slate-600">Manage your product listings and inventory</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={bulkImportInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleBulkImport}
            className="hidden"
            id="bulk-import-input"
          />
          <Button 
            variant="outline" 
            disabled={bulkImporting}
            onClick={() => bulkImportInputRef.current?.click()}
          >
            {bulkImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Bulk Import
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All ({products.length})
              </Button>
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status as VendorProductStatus)}
                >
                  {label} ({statusCounts[status as VendorProductStatus]})
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600">
              {searchQuery || statusFilter !== 'all'
                ? 'No products match your filters.'
                : 'No products yet. Start by adding your first product!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const isProcessing = processingIds.has(product.id)
            const coverImage = product.gallery[0]?.url ?? product.primaryImageUrl

            return (
              <Card key={product.id} className="overflow-hidden">
                {coverImage && (
                  <div className="aspect-video w-full overflow-hidden bg-slate-100">
                    <img
                      src={coverImage}
                      alt={product.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 line-clamp-2">{product.title}</h3>
                      <p className="mt-1 text-sm font-medium text-emerald-600">
                        {formatPrice(product.price, product.currency)}
                      </p>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-full border px-2 py-1 text-xs font-medium ${STATUS_COLORS[product.status]}`}
                    >
                      {STATUS_LABELS[product.status]}
                    </span>
                  </div>

                  {product.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-slate-600">{product.description}</p>
                  )}

                  {/* Moderation Feedback */}
                  {product.moderation?.status === 'blocked' && (
                    <div className="mb-3 rounded-md bg-rose-50 p-3 text-xs text-rose-700">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <div>
                          <p className="font-semibold">Rejected</p>
                          {product.moderation.message && <p className="mt-1">{product.moderation.message}</p>}
                          {product.moderation.reasons && product.moderation.reasons.length > 0 && (
                            <ul className="mt-1 list-disc pl-4">
                              {product.moderation.reasons.map((reason, idx) => (
                                <li key={idx}>{reason}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {product.moderation?.status === 'review' && (
                    <div className="mb-3 rounded-md bg-amber-50 p-3 text-xs text-amber-700">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <div>
                          <p className="font-semibold">Under Review</p>
                          {product.moderation.message && <p className="mt-1">{product.moderation.message}</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingProduct(product)}
                      disabled={isProcessing}
                    >
                      <Edit2 className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicate(product)}
                      disabled={isProcessing}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Duplicate
                    </Button>
                    {product.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(product.id, 'archived')}
                        disabled={isProcessing}
                      >
                        <Archive className="mr-1 h-3 w-3" />
                        Archive
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(product.id, 'active')}
                        disabled={isProcessing}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Activate
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(product.id)}
                      disabled={isProcessing}
                      className="text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit Dialog */}
      {editingProduct && (
        <ProductEditDialog
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            setEditingProduct(null)
            onProductUpdated?.()
          }}
        />
      )}
    </div>
  )
}

