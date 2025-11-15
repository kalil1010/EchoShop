'use client'

import React from 'react'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { VendorProduct } from '@/types/vendor'

interface ProductDetailViewProps {
  product: VendorProduct
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

export default function ProductDetailView({ product }: ProductDetailViewProps) {
  const router = useRouter()
  const coverImage = product.gallery[0]?.url ?? product.primaryImageUrl
  const vendorName = product.vendorName ?? 'Echo Shop Vendor'

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Button variant="ghost" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Marketplace
      </Button>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Product Images */}
        <div className="space-y-4">
          {coverImage && (
            <div className="aspect-square w-full overflow-hidden rounded-lg border bg-slate-100">
              <img
                src={coverImage}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          {product.gallery.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.gallery.slice(1, 5).map((image, idx) => (
                <div key={idx} className="aspect-square overflow-hidden rounded border bg-slate-100">
                  <img
                    src={image.url}
                    alt={`${product.title} - Image ${idx + 2}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{product.title}</h1>
            <p className="mt-2 text-sm uppercase tracking-wide text-purple-600">{vendorName}</p>
          </div>

          <div>
            <p className="text-3xl font-bold text-emerald-600">
              {formatPrice(product.price, product.currency)}
            </p>
          </div>

          {(product.description || product.aiDescription) && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 whitespace-pre-wrap">
                  {product.description || product.aiDescription}
                </p>
              </CardContent>
            </Card>
          )}

          {product.aiColors && product.aiColors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {product.aiColors.map((color, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2"
                    >
                      <div
                        className="h-5 w-5 rounded-full border border-slate-300"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="text-sm font-medium text-slate-700">{color.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4">
            <Button size="lg" className="flex-1">
              <ShoppingBag className="mr-2 h-5 w-5" />
              Add to Cart
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

