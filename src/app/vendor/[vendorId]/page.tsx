'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { MapPin, Store, Mail, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PostCard } from '@/components/post/PostCard'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/toast'
import type { Post } from '@/types/post'
import type { VendorProduct } from '@/types/vendor'

interface VendorProfile {
  id: string
  displayName?: string
  photoURL?: string
  businessName?: string
  bio?: string
  location?: string
  email?: string
  website?: string
  followersCount: number
  postsCount: number
}

export default function VendorBrandPage({ params }: { params: Promise<{ vendorId: string }> }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [vendorId, setVendorId] = useState<string | null>(null)
  const [vendor, setVendor] = useState<VendorProfile | null>(null)
  const [products, setProducts] = useState<VendorProduct[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [following, setFollowing] = useState(false)

  useEffect(() => {
    async function loadParams() {
      const resolved = await params
      setVendorId(resolved.vendorId)
    }
    loadParams()
  }, [params])

  useEffect(() => {
    if (!vendorId) return

    async function loadVendorData() {
      setLoading(true)
      try {
        const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData?.session?.access_token

        // Load vendor profile
        const profileResponse = await fetch(`/api/users/${vendorId}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        })

        if (profileResponse.ok) {
          const profileData = await profileResponse.json()
          setVendor({
            id: profileData.user.id,
            displayName: profileData.user.displayName,
            photoURL: profileData.user.photoURL,
            businessName: profileData.user.businessName,
            bio: profileData.user.bio,
            location: profileData.user.location,
            email: profileData.user.email,
            website: profileData.user.website,
            followersCount: profileData.user.followersCount || 0,
            postsCount: profileData.user.postsCount || 0,
          })
        }

        // Load products
        const productsResponse = await fetch(`/api/vendor/products?vendorId=${vendorId}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        })

        if (productsResponse.ok) {
          const productsData = await productsResponse.json()
          setProducts(productsData.products || [])
        }

        // Load vendor posts
        const postsResponse = await fetch(`/api/posts?userId=${vendorId}&limit=20`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        })

        if (postsResponse.ok) {
          const postsData = await postsResponse.json()
          setPosts(postsData.posts || [])
        }

        // Check follow status
        if (user) {
          const followResponse = await fetch(`/api/users/${vendorId}/follow-status`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })

          if (followResponse.ok) {
            const followData = await followResponse.json()
            setIsFollowing(followData.isFollowing)
          }
        }
      } catch (error) {
        console.error('[VendorBrandPage] Error:', error)
        toast({
          variant: 'error',
          title: 'Failed to load vendor',
          description: 'Please try again later.',
        })
      } finally {
        setLoading(false)
      }
    }

    loadVendorData()
  }, [vendorId, user, toast])

  const handleFollow = async () => {
    if (!user || !vendorId) return

    try {
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) return

      const method = isFollowing ? 'DELETE' : 'POST'
      const url = isFollowing
        ? `/api/follow?followingId=${vendorId}`
        : '/api/follow'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: method === 'POST' ? JSON.stringify({ followingId: vendorId }) : undefined,
      })

      if (response.ok) {
        setIsFollowing(!isFollowing)
        setVendor((prev) =>
          prev
            ? {
                ...prev,
                followersCount: isFollowing
                  ? prev.followersCount - 1
                  : prev.followersCount + 1,
              }
            : null
        )
      }
    } catch (error) {
      console.error('[VendorBrandPage] Follow error:', error)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Vendor not found</h1>
          <p className="text-gray-600">This vendor profile does not exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-shrink-0">
            {vendor.photoURL ? (
              <Image
                src={vendor.photoURL}
                alt={vendor.businessName || vendor.displayName || 'Vendor'}
                width={120}
                height={120}
                className="rounded-full"
              />
            ) : (
              <div className="w-30 h-30 rounded-full bg-gray-200 flex items-center justify-center">
                <Store className="h-16 w-16 text-gray-400" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">
              {vendor.businessName || vendor.displayName || 'Vendor'}
            </h1>
            {vendor.bio && <p className="text-gray-600 mb-4">{vendor.bio}</p>}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
              {vendor.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {vendor.location}
                </div>
              )}
              <div>
                <span className="font-semibold">{vendor.followersCount}</span> followers
              </div>
              <div>
                <span className="font-semibold">{vendor.postsCount}</span> posts
              </div>
              <div>
                <span className="font-semibold">{products.length}</span> products
              </div>
            </div>
            <div className="flex gap-2">
              {user && user.uid !== vendor.id && (
                <Button onClick={handleFollow} disabled={following}>
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </Button>
              )}
              {vendor.website && (
                <a
                  href={vendor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                    "h-10 px-4 py-2"
                  )}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Visit Website
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      {products.length > 0 && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {products.slice(0, 8).map((product) => (
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
                  <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.title}</h3>
                  <p className="text-sm font-semibold text-purple-600">
                    {product.currency} {product.price.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {products.length > 8 && (
            <div className="mt-4 text-center">
              <a
                href={`/marketplace?vendor=${vendorId}`}
                className={cn(
                  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                  "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                  "h-10 px-4 py-2"
                )}
              >
                View All Products
              </a>
            </div>
          )}
        </div>
      )}

      {/* Posts */}
      {posts.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Posts</h2>
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

