'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingBag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { isRouteAccessible } from '@/lib/roles'
import type { VendorProduct } from '@/types/vendor'

interface ProductCardProps {
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

export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter()
  const { user, userProfile, profileStatus } = useAuth()
  const coverImage = product.gallery[0]?.url ?? product.primaryImageUrl
  const vendorName = product.vendorName ?? 'Echo Shop Vendor'

  // Task B3: Handle View Details with proper auth check
  const handleViewDetails = () => {
    const targetRoute = `/marketplace/product/${product.id}`

    // If authenticated (any role) and profile is ready
    if (user && profileStatus === 'ready' && userProfile) {
      // Check if user can access marketplace routes
      if (isRouteAccessible(userProfile.role, '/marketplace')) {
        router.push(targetRoute)
        return
      }
    }

    // If loading (still hydrating session), show loading state
    if (profileStatus === 'loading') {
      // Don't redirect, just wait - the user is likely authenticated
      // The component will re-render when profile loads
      return
    }

    // If not authenticated or profile failed to load
    if (!user || profileStatus === 'idle' || profileStatus === 'error') {
      router.push(`/auth?redirect=${encodeURIComponent(targetRoute)}`)
      return
    }
  }

  return (
    <article className="group overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
        {coverImage ? (
          <img
            src={coverImage}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Image coming soon
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground line-clamp-2">{product.title}</h2>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            {formatPrice(product.price, product.currency)}
          </span>
        </div>
        <p className="text-xs uppercase tracking-wide text-purple-600">{vendorName}</p>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {product.description ?? product.aiDescription ?? 'No description provided.'}
        </p>
        <Button
          onClick={handleViewDetails}
          variant="outline"
          className="w-full"
          disabled={profileStatus === 'loading'}
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          {profileStatus === 'loading' ? 'Loading...' : 'View Details'}
        </Button>
      </div>
    </article>
  )
}

