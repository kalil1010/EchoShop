'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import type { VendorProduct, VendorProductStatus } from '@/types/vendor'

interface VendorDashboardProps {
  initialProducts: unknown[]
  vendorName: string
}

interface VendorProductFormProps {
  onCreated: (product: VendorProduct) => void
}

interface VendorProductCardProps {
  product: VendorProduct
  isBusy: 'status' | 'delete' | null
  onStatusChange: (productId: string, status: VendorProductStatus) => Promise<void>
  onDelete: (productId: string) => Promise<void>
}

type ApiProductGalleryEntry = {
  url?: unknown
  path?: unknown
}

type ApiProductPayload = {
  id?: unknown
  vendorId?: unknown
  title?: unknown
  description?: unknown
  price?: unknown
  currency?: unknown
  status?: unknown
  primaryImageUrl?: unknown
  primaryImagePath?: unknown
  gallery?: unknown
  moderation?: {
    status?: 'ok' | 'review' | 'blocked' | 'error'
    message?: unknown
    category?: unknown
    reasons?: unknown
  }
  aiDescription?: unknown
  aiColors?: Array<{ name?: unknown; hex?: unknown }> | string[] | null
  createdAt?: unknown
  updatedAt?: unknown
}

const mapProductFromApi = (payload: unknown): VendorProduct => {
  const record = (payload ?? {}) as ApiProductPayload
  const createdAt = typeof record.createdAt === 'string' ? new Date(record.createdAt) : new Date()
  const updatedAt = typeof record.updatedAt === 'string' ? new Date(record.updatedAt) : createdAt
  const galleryRaw = Array.isArray(record.gallery) ? (record.gallery as ApiProductGalleryEntry[]) : []
  const gallery = galleryRaw.map((entry) => ({
    url: typeof entry?.url === 'string' ? entry.url : '',
    path: typeof entry?.path === 'string' ? entry.path : undefined,
  }))

  const rawStatus = typeof record.status === 'string' ? record.status.toLowerCase() : 'draft'
  const status = STATUS_NORMALISE_MAP[rawStatus] ?? 'draft'

  return {
    id: String(record.id ?? ''),
    vendorId: String(record.vendorId ?? ''),
    title: String(record.title ?? ''),
    description: typeof record.description === 'string' ? record.description : undefined,
    price: typeof record.price === 'number' ? record.price : Number(record.price ?? 0),
    currency: typeof record.currency === 'string' && record.currency ? record.currency : 'EGP',
    status,
    primaryImageUrl: typeof record.primaryImageUrl === 'string' ? record.primaryImageUrl : '',
    primaryImagePath:
      typeof record.primaryImagePath === 'string' && record.primaryImagePath
        ? record.primaryImagePath
        : undefined,
    gallery,
    moderation: (() => {
      if (!record.moderation) return undefined
      const allowedStatuses = new Set(['ok', 'review', 'blocked', 'error'])
      const rawStatus = record.moderation.status
      const status = typeof rawStatus === 'string' && allowedStatuses.has(rawStatus)
        ? (rawStatus as 'ok' | 'review' | 'blocked' | 'error')
        : 'review'

      return {
        status,
        message: typeof record.moderation.message === 'string' ? record.moderation.message : undefined,
        category: typeof record.moderation.category === 'string' ? record.moderation.category : undefined,
        reasons: Array.isArray(record.moderation.reasons)
          ? (record.moderation.reasons as string[])
          : undefined,
      }
    })(),
    aiDescription:
      typeof record.aiDescription === 'string' && record.aiDescription ? record.aiDescription : undefined,
    aiColors: Array.isArray(record.aiColors)
      ? (record.aiColors as Array<{ name?: unknown; hex?: unknown }> | string[])
          .map((entry) => {
            if (typeof entry === 'string') {
              return { name: entry, hex: entry }
            }
            if (entry && typeof entry === 'object') {
              const hexValue = typeof entry.hex === 'string' ? entry.hex : undefined
              const nameValue = typeof entry.name === 'string' ? entry.name : hexValue ?? undefined
              if (hexValue) {
                return { name: nameValue ?? hexValue, hex: hexValue }
              }
            }
            return null
          })
          .filter((entry): entry is { name: string; hex: string } => Boolean(entry && entry.hex))
      : undefined,
    createdAt,
    updatedAt,
  }
}

const STATUS_LABELS: Record<VendorProductStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  active: 'Active',
  rejected: 'Rejected',
  archived: 'Archived',
}

const STATUS_NORMALISE_MAP: Record<string, VendorProductStatus> = {
  draft: 'draft',
  pending_review: 'pending_review',
  pending: 'pending_review',
  review: 'pending_review',
  active: 'active',
  approved: 'active',
  rejected: 'rejected',
  denied: 'rejected',
  archived: 'archived',
}

const statusVariants: Record<VendorProductStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending_review: 'bg-amber-100 text-amber-700 border-amber-200',
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
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

function VendorProductForm({ onCreated }: VendorProductFormProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    setSelectedFiles(files)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)

    const title = formData.get('title')
    if (!title || !String(title).trim()) {
      toast({ variant: 'error', title: 'Missing title', description: 'Please add a product name.' })
      return
    }

    if (!selectedFiles.length) {
      toast({ variant: 'error', title: 'Product image required', description: 'Upload at least one product photo.' })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/vendor/products', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message =
          typeof payload?.error === 'string' ? payload.error : 'Could not create product. Please try again.'
        throw new Error(message)
      }

      const payload = await response.json()
      const product = mapProductFromApi(payload?.product)
      onCreated(product)

      setSelectedFiles([])
      form.reset()
      toast({ variant: 'success', title: 'Product added', description: 'Your listing has been created.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create product right now.'
      toast({ variant: 'error', title: 'Upload failed', description: message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a new product</CardTitle>
        <CardDescription>Upload images, set pricing, and publish to the marketplace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit} encType="multipart/form-data">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              Product name
            </label>
            <Input id="title" name="title" placeholder="e.g. Linen Wrap Dress" maxLength={120} required />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              placeholder="Tell shoppers about the fit, fabric, or styling ideas."
              rows={4}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">Markdown is not supported. Keep it descriptive and friendly.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="price" className="text-sm font-medium">
                Price
              </label>
              <Input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="899.00"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="currency" className="text-sm font-medium">
                Currency
              </label>
              <Input id="currency" name="currency" maxLength={4} defaultValue="EGP" placeholder="EGP" />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="images" className="text-sm font-medium">
              Product images
            </label>
            <Input
              id="images"
              name="images"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleFileChange}
            />
            {selectedFiles.length > 0 ? (
              <ul className="list-disc pl-6 text-sm text-muted-foreground">
                {selectedFiles.map((file) => (
                  <li key={file.name}>{file.name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Upload clear, well-lit photos (JPG, PNG, or WEBP). The first image becomes the cover.
              </p>
            )}
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Publishing…' : 'Publish product'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function VendorProductCard({ product, isBusy, onStatusChange, onDelete }: VendorProductCardProps) {
  const coverImage = product.gallery[0]?.url ?? product.primaryImageUrl
  const formattedPrice = useMemo(() => formatPrice(product.price, product.currency), [product.price, product.currency])

  return (
    <Card className="overflow-hidden">
      {coverImage ? (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img src={coverImage} alt={product.title} loading="lazy" className="h-full w-full object-cover" />
        </div>
      ) : null}
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{product.title}</h3>
            <p className="text-sm text-muted-foreground">{formattedPrice}</p>
          </div>
          <span
            className={`whitespace-nowrap rounded-full border px-2 py-1 text-xs font-medium ${statusVariants[product.status]}`}
          >
            {STATUS_LABELS[product.status]}
          </span>
        </div>

        {product.description ? (
          <p className="text-sm text-muted-foreground line-clamp-3">{product.description}</p>
        ) : null}

        {product.moderation?.status === 'review' ? (
          <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-700">
            Pending review: {product.moderation.message ?? 'Our team will review this item shortly.'}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {product.status !== 'active' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange(product.id, 'active')}
              disabled={isBusy !== null}
            >
              {isBusy === 'status' ? 'Updating…' : 'Mark active'}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusChange(product.id, 'draft')}
              disabled={isBusy !== null}
            >
              {isBusy === 'status' ? 'Updating…' : 'Move to draft'}
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(product.id)}
            disabled={isBusy !== null}
          >
            {isBusy === 'delete' ? 'Removing…' : 'Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const PRODUCTS_PER_PAGE = 100

export default function VendorDashboard({ initialProducts, vendorName }: VendorDashboardProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [products, setProducts] = useState<VendorProduct[]>(() =>
    Array.isArray(initialProducts) ? initialProducts.map(mapProductFromApi) : [],
  )
  const [busyProducts, setBusyProducts] = useState<Record<string, 'status' | 'delete'>>({})
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(products.length)

  const handleProductCreated = (product: VendorProduct) => {
    setProducts((prev) => [product, ...prev])
  }

  const loadMoreProducts = useCallback(async () => {
    if (loadingMore || !hasMore) return
    
    setLoadingMore(true)
    try {
      const url = `/api/vendor/products?limit=${PRODUCTS_PER_PAGE}&offset=${offset}`
      const response = await fetch(url, { credentials: 'include' })
      
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to load more products.')
      }
      
      const payload = await response.json()
      const newProducts: VendorProduct[] = Array.isArray(payload?.products)
        ? payload.products.map(mapProductFromApi)
        : []
      
      setProducts((prev) => [...prev, ...newProducts])
      setHasMore(newProducts.length === PRODUCTS_PER_PAGE)
      setOffset((prev) => prev + newProducts.length)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load more products.'
      toast({ variant: 'error', title: 'Load failed', description: message })
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, offset, toast])

  // Check if we should show "Load More" on initial load
  React.useEffect(() => {
    setHasMore(products.length >= PRODUCTS_PER_PAGE)
  }, [products.length])

  const handleStatusChange = async (productId: string, status: VendorProductStatus) => {
    setBusyProducts((prev) => ({ ...prev, [productId]: 'status' }))
    try {
      const response = await fetch(`/api/vendor/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Unable to update the product status right now.'
        throw new Error(message)
      }

      const payload = await response.json()
      const updated = mapProductFromApi(payload?.product)
      setProducts((prev) => prev.map((product) => (product.id === productId ? updated : product)))
      toast({ variant: 'success', title: 'Status updated', description: `Item is now ${STATUS_LABELS[status]}.` })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update product status.'
      toast({ variant: 'error', title: 'Update failed', description: message })
    } finally {
      setBusyProducts((prev) => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
    }
  }

  const handleDelete = async (productId: string) => {
    const confirmed = window.confirm('Delete this product? This action cannot be undone.')
    if (!confirmed) return

    setBusyProducts((prev) => ({ ...prev, [productId]: 'delete' }))
    try {
      const response = await fetch(`/api/vendor/products/${productId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message =
          typeof payload?.error === 'string' ? payload.error : 'Could not delete the product just yet.'
        throw new Error(message)
      }

      setProducts((prev) => prev.filter((product) => product.id !== productId))
      toast({ variant: 'success', title: 'Product removed', description: 'The listing has been deleted.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete the product.'
      toast({ variant: 'error', title: 'Delete failed', description: message })
    } finally {
      setBusyProducts((prev) => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
    }
  }

  const productsEmpty = products.length === 0

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Welcome back, {vendorName}!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload fresh arrivals, tune your listings, and keep shoppers inspired.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.refresh()}>
            Refresh data
          </Button>
          <Button variant="ghost" onClick={() => router.push('/marketplace')}>
            View marketplace
          </Button>
        </div>
      </div>

      <VendorProductForm onCreated={handleProductCreated} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Your listings</h2>
          <span className="text-sm text-muted-foreground">{products.length} active item(s)</span>
        </div>

        {productsEmpty ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <p className="font-medium text-foreground">No products yet</p>
            <p className="mt-1 text-sm">
              Publish your first listing and it will appear here. Shoppers can browse everything in the marketplace.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <VendorProductCard
                  key={product.id}
                  product={product}
                  isBusy={busyProducts[product.id] ?? null}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            
            {hasMore && (
              <div className="flex justify-center pt-6">
                <Button
                  variant="outline"
                  onClick={loadMoreProducts}
                  disabled={loadingMore}
                  className="gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Load More ({products.length} loaded)
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
