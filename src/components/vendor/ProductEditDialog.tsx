'use client'

import React, { useState, useCallback, useRef } from 'react'
import { X, Upload, Loader2, Sparkles, AlertCircle } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import type { VendorProduct, VendorProductStatus } from '@/types/vendor'

interface ProductEditDialogProps {
  product: VendorProduct
  onClose: () => void
  onSaved: () => void
}

const STATUS_OPTIONS: Array<{ value: VendorProductStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

export default function ProductEditDialog({ product, onClose, onSaved }: ProductEditDialogProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: product.title,
    description: product.description || '',
    price: product.price.toString(),
    currency: product.currency,
    status: product.status,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast({
        variant: 'error',
        title: 'Title required',
        description: 'Please provide a product name.',
      })
      return
    }

    const price = Number.parseFloat(formData.price)
    if (Number.isNaN(price) || price < 0) {
      toast({
        variant: 'error',
        title: 'Invalid price',
        description: 'Please enter a valid price.',
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/vendor/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          price,
          currency: formData.currency,
          status: formData.status,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to update product')
      }

      toast({
        variant: 'success',
        title: 'Product updated',
        description: 'Your changes have been saved.',
      })

      onSaved()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update product'
      toast({
        variant: 'error',
        title: 'Update failed',
        description: message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Edit Product</CardTitle>
            <CardDescription>Update product details and status</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="edit-title" className="text-sm font-medium">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                maxLength={120}
                required
              />
              <p className="text-xs text-slate-500">{formData.title.length}/120 characters</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-slate-500">{formData.description.length}/2000 characters</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="edit-price" className="text-sm font-medium">
                  Price <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="edit-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-currency" className="text-sm font-medium">
                  Currency
                </label>
                <Input
                  id="edit-currency"
                  value={formData.currency}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                  maxLength={4}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-status" className="text-sm font-medium">
                Status
              </label>
              <select
                id="edit-status"
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as VendorProductStatus }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Moderation Feedback */}
            {product.moderation && (
              <div className="rounded-md border p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">Moderation Status</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Status: <span className="font-medium">{product.moderation.status}</span>
                    </p>
                    {product.moderation.message && (
                      <p className="mt-2 text-sm text-slate-700">{product.moderation.message}</p>
                    )}
                    {product.moderation.reasons && product.moderation.reasons.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-slate-700">Issues to address:</p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                          {product.moderation.reasons.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

