'use client'

import React from 'react'
import Image from 'next/image'
import { ShoppingBag, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { VendorProduct } from '@/types/vendor'

interface ShoppableProductsProps {
  productIds: string[]
  products?: VendorProduct[]
  onProductClick?: (productId: string) => void
}

export function ShoppableProducts({
  productIds,
  products = [],
  onProductClick,
}: ShoppableProductsProps) {
  if (productIds.length === 0) return null

  const displayedProducts = products.filter((p) => productIds.includes(p.id))

  if (displayedProducts.length === 0) {
    return (
      <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
        <div className="flex items-center gap-2 text-purple-700">
          <ShoppingBag className="h-5 w-5" />
          <span className="font-medium">Shop this look</span>
        </div>
        <p className="text-sm text-purple-600 mt-1">
          {productIds.length} product{productIds.length !== 1 ? 's' : ''} available
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 text-purple-700">
        <ShoppingBag className="h-5 w-5" />
        <span className="font-medium">Shop this look</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {displayedProducts.map((product) => (
          <div
            key={product.id}
            className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            {product.primaryImageUrl && (
              <div className="relative aspect-square bg-gray-100">
                <Image
                  src={product.primaryImageUrl}
                  alt={product.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="p-3">
              <h4 className="font-medium text-sm line-clamp-2 mb-1">{product.title}</h4>
              <p className="text-sm font-semibold text-purple-600 mb-2">
                {product.currency} {product.price.toFixed(2)}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onProductClick?.(product.id)}
              >
                <ExternalLink className="mr-2 h-3 w-3" />
                View Product
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

