'use client'

import React, { useState } from 'react'
import { Star, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Review {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  rating: number
  comment: string
  helpful: number
  createdAt: string
  productId?: string
}

interface ProductReviewsProps {
  vendorId: string
  productId?: string
}

export default function ProductReviews({ vendorId, productId }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  // TODO: Fetch reviews from API
  // For now, using placeholder data
  React.useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setReviews([
        {
          id: '1',
          userId: 'user1',
          userName: 'Sarah M.',
          rating: 5,
          comment: 'Great quality and fast shipping! Highly recommend this vendor.',
          helpful: 8,
          createdAt: '2024-01-15',
          productId,
        },
        {
          id: '2',
          userId: 'user2',
          userName: 'Ahmed K.',
          rating: 4,
          comment: 'Good product, exactly as described. Would buy again.',
          helpful: 5,
          createdAt: '2024-01-10',
          productId,
        },
      ])
      setLoading(false)
    }, 500)
  }, [vendorId, productId])

  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
    percentage: reviews.length > 0 ? (reviews.filter((r) => r.rating === rating).length / reviews.length) * 100 : 0,
  }))

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading reviews...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Customer Reviews</CardTitle>
            <CardDescription>
              {reviews.length === 0
                ? 'No reviews yet'
                : `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}`}
            </CardDescription>
          </div>
          {reviews.length > 0 && (
            <div className="text-right">
              <div className="flex items-center gap-1">
                <span className="text-3xl font-bold">{averageRating.toFixed(1)}</span>
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(averageRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : i < averageRating
                            ? 'fill-yellow-200 text-yellow-200'
                            : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {reviews.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No reviews yet</p>
            <p className="text-sm mt-1">Be the first to review this vendor!</p>
          </div>
        ) : (
          <>
            {/* Rating Distribution */}
            <div className="space-y-2">
              {ratingDistribution.map(({ rating, count, percentage }) => (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-20">
                    <span className="text-sm font-medium">{rating}</span>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">{count}</span>
                </div>
              ))}
            </div>

            {/* Reviews List */}
            <div className="space-y-4 pt-4 border-t">
              {reviews.map((review) => (
                <div key={review.id} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {review.userAvatar ? (
                        <img
                          src={review.userAvatar}
                          alt={review.userName}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <span className="text-emerald-700 font-medium">
                            {review.userName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{review.userName}</p>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{review.comment}</p>
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" className="h-8 text-xs">
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      Helpful ({review.helpful})
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

