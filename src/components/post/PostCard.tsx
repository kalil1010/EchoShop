'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Heart, MessageCircle, Bookmark, Share2, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Post } from '@/types/post'
import { formatDistanceToNow } from 'date-fns'

interface PostCardProps {
  post: Post
  onLike?: (postId: string) => void
  onComment?: (postId: string) => void
  onSave?: (postId: string) => void
  onShare?: (postId: string) => void
  showComments?: boolean
}

export function PostCard({
  post,
  onLike,
  onComment,
  onSave,
  onShare,
  showComments = false,
}: PostCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLiked, setIsLiked] = useState(post.engagement.userLiked)
  const [isSaved, setIsSaved] = useState(post.engagement.userSaved)
  const [likesCount, setLikesCount] = useState(post.engagement.likesCount)

  const handleLike = () => {
    const newLiked = !isLiked
    setIsLiked(newLiked)
    setLikesCount((prev) => (newLiked ? prev + 1 : prev - 1))
    onLike?.(post.id)
  }

  const handleSave = () => {
    setIsSaved(!isSaved)
    onSave?.(post.id)
  }

  const handleShare = () => {
    onShare?.(post.id)
  }

  const handleComment = () => {
    onComment?.(post.id)
  }

  const hasMultipleImages = post.images.length > 1
  const currentImage = post.images[currentImageIndex]

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {post.user?.photoURL ? (
            <Image
              src={post.user.photoURL}
              alt={post.user.displayName || 'User'}
              width={40}
              height={40}
              className="rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500 text-sm">
                {(post.user?.displayName || 'U')[0].toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <div className="font-semibold">{post.user?.displayName || 'Anonymous'}</div>
            <div className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Images */}
      {currentImage && (
        <div className="relative aspect-square bg-gray-100">
          <Image
            src={currentImage.url}
            alt={post.caption || 'Post image'}
            fill
            className="object-cover"
          />
          {hasMultipleImages && (
            <>
              {currentImageIndex > 0 && (
                <button
                  onClick={() => setCurrentImageIndex((prev) => prev - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {currentImageIndex < post.images.length - 1 && (
                <button
                  onClick={() => setCurrentImageIndex((prev) => prev + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {post.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentImageIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Engagement Bar */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 ${isLiked ? 'text-red-500' : 'text-gray-700'}`}
          >
            <Heart className={`h-6 w-6 ${isLiked ? 'fill-current' : ''}`} />
            <span className="text-sm font-medium">{likesCount}</span>
          </button>
          <button
            onClick={handleComment}
            className="flex items-center gap-2 text-gray-700"
          >
            <MessageCircle className="h-6 w-6" />
            <span className="text-sm font-medium">{post.engagement.commentsCount}</span>
          </button>
          <button
            onClick={handleSave}
            className={`ml-auto ${isSaved ? 'text-yellow-500' : 'text-gray-700'}`}
          >
            <Bookmark className={`h-6 w-6 ${isSaved ? 'fill-current' : ''}`} />
          </button>
          <button onClick={handleShare} className="text-gray-700">
            <Share2 className="h-6 w-6" />
          </button>
        </div>

        {/* Caption */}
        {post.caption && (
          <div className="text-sm">
            <span className="font-semibold">{post.user?.displayName || 'Anonymous'}</span>{' '}
            <span>{post.caption}</span>
          </div>
        )}

        {/* View Comments */}
        {post.engagement.commentsCount > 0 && (
          <button
            onClick={handleComment}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            View all {post.engagement.commentsCount} comment{post.engagement.commentsCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  )
}

