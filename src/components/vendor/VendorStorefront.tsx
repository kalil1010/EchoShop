'use client'

import React, { useMemo, useState } from 'react'
import {
  Share2,
  MessageCircle,
  Star,
  Filter,
  ArrowUpDown,
  Instagram,
  Facebook,
  Twitter,
  Globe,
  Mail,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import type { VendorProduct } from '@/types/vendor'
import ProductCard from '@/components/marketplace/ProductCard'
import ProductReviews from './ProductReviews'
import AskSellerModal from './AskSellerModal'

interface VendorStorefrontProps {
  vendorId: string
  vendorName: string
  vendorDescription?: string
  vendorWebsite?: string
  vendorContactEmail?: string
  vendorPhotoUrl?: string
  products: VendorProduct[]
}

type SortOption = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'name-asc' | 'name-desc'
type FilterOption = 'all' | 'under-100' | '100-500' | '500-1000' | 'over-1000'

export default function VendorStorefront({
  vendorId,
  vendorName,
  vendorDescription,
  vendorWebsite,
  vendorContactEmail,
  vendorPhotoUrl,
  products: initialProducts,
}: VendorStorefrontProps) {
  const { toast } = useToast()
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [showAskSeller, setShowAskSeller] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...initialProducts]

    // Apply price filter
    if (filterBy !== 'all') {
      filtered = filtered.filter((product) => {
        const price = product.price
        switch (filterBy) {
          case 'under-100':
            return price < 100
          case '100-500':
            return price >= 100 && price < 500
          case '500-1000':
            return price >= 500 && price < 1000
          case 'over-1000':
            return price >= 1000
          default:
            return true
        }
      })
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.updatedAt.getTime() - a.updatedAt.getTime()
        case 'oldest':
          return a.updatedAt.getTime() - b.updatedAt.getTime()
        case 'price-low':
          return a.price - b.price
        case 'price-high':
          return b.price - a.price
        case 'name-asc':
          return a.title.localeCompare(b.title)
        case 'name-desc':
          return b.title.localeCompare(a.title)
        default:
          return 0
      }
    })

    return filtered
  }, [initialProducts, sortBy, filterBy])

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${vendorName} - Echo Shop`,
          text: vendorDescription || `Check out ${vendorName} on Echo Shop`,
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
        toast({
          variant: 'success',
          title: 'Link copied',
          description: 'Store link copied to clipboard!',
        })
      }
    } catch (error) {
      // User cancelled share or error occurred
      if (error instanceof Error && error.name !== 'AbortError') {
        await navigator.clipboard.writeText(url)
        toast({
          variant: 'success',
          title: 'Link copied',
          description: 'Store link copied to clipboard!',
        })
      }
    }
  }

  const handleAskSeller = (productId?: string) => {
    setSelectedProductId(productId || null)
    setShowAskSeller(true)
  }

  const averageRating = 4.5 // TODO: Calculate from actual reviews
  const reviewCount = 12 // TODO: Get from actual reviews

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Vendor Header */}
      <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white">
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            {vendorPhotoUrl && (
              <div className="flex-shrink-0">
                <img
                  src={vendorPhotoUrl}
                  alt={vendorName}
                  className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md"
                />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">{vendorName}</CardTitle>
                  {reviewCount > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(averageRating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : i < averageRating
                                  ? 'fill-yellow-200 text-yellow-200'
                                  : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {averageRating.toFixed(1)} ({reviewCount} reviews)
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleAskSeller()}>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Ask Seller
                  </Button>
                </div>
              </div>
              {vendorDescription && (
                <CardDescription className="text-base text-foreground/80">
                  {vendorDescription}
                </CardDescription>
              )}
              <div className="flex flex-wrap gap-4 pt-2">
                {vendorWebsite && (
                  <a
                    href={vendorWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                  </a>
                )}
                {vendorContactEmail && (
                  <a
                    href={`mailto:${vendorContactEmail}`}
                    className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
                  >
                    <Mail className="h-4 w-4" />
                    Contact
                  </a>
                )}
                {/* TODO: Add social media links when available */}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter:</span>
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as FilterOption)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="all">All Prices</option>
            <option value="under-100">Under 100 EGP</option>
            <option value="100-500">100 - 500 EGP</option>
            <option value="500-1000">500 - 1000 EGP</option>
            <option value="over-1000">Over 1000 EGP</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="name-asc">Name: A-Z</option>
            <option value="name-desc">Name: Z-A</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      {filteredAndSortedProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-foreground">No products found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filterBy !== 'all'
                ? 'Try adjusting your filters to see more products.'
                : 'This vendor hasn\'t added any products yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAndSortedProducts.map((product) => (
            <div key={product.id} className="relative group">
              <ProductCard product={{ ...product, vendorName: vendorName }} />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white shadow-sm"
                onClick={() => handleAskSeller(product.id)}
                aria-label="Ask seller about this product"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Reviews Section */}
      <ProductReviews vendorId={vendorId} />

      {/* Ask Seller Modal */}
      <AskSellerModal
        isOpen={showAskSeller}
        onClose={() => {
          setShowAskSeller(false)
          setSelectedProductId(null)
        }}
        vendorId={vendorId}
        vendorName={vendorName}
        productId={selectedProductId}
      />
    </div>
  )
}

