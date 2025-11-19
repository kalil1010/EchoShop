'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, MessageCircle } from 'lucide-react'
import type { Post } from '@/types/post'

interface PostGridProps {
  posts: Post[]
  columns?: number
  onPostClick?: (post: Post) => void
}

export function PostGrid({ posts, columns = 3, onPostClick }: PostGridProps) {
  const [hoveredPost, setHoveredPost] = useState<string | null>(null)

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No posts yet.</p>
      </div>
    )
  }

  // Organize posts into columns for masonry layout
  const columnPosts: Post[][] = Array.from({ length: columns }, () => [])

  posts.forEach((post, index) => {
    const columnIndex = index % columns
    columnPosts[columnIndex].push(post)
  })

  const handlePostClick = (post: Post) => {
    if (onPostClick) {
      onPostClick(post)
    }
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {columnPosts.map((column, columnIndex) => (
        <div key={columnIndex} className="flex flex-col gap-4">
          {column.map((post) => {
            const firstImage = post.images[0]
            if (!firstImage) return null

            const isHovered = hoveredPost === post.id

            return (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="relative group cursor-pointer"
                onMouseEnter={() => setHoveredPost(post.id)}
                onMouseLeave={() => setHoveredPost(null)}
                onClick={(e) => {
                  if (onPostClick) {
                    e.preventDefault()
                    handlePostClick(post)
                  }
                }}
              >
                <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <Image
                    src={firstImage.url}
                    alt={post.caption || 'Post'}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Overlay on hover */}
                  <div
                    className={`absolute inset-0 bg-black transition-opacity duration-300 ${
                      isHovered ? 'opacity-40' : 'opacity-0'
                    }`}
                  />
                  {/* Engagement stats on hover */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center gap-6 text-white transition-opacity duration-300 ${
                      isHovered ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Heart className="h-6 w-6 fill-current" />
                      <span className="font-semibold">{post.engagement.likesCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-6 w-6 fill-current" />
                      <span className="font-semibold">{post.engagement.commentsCount}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )
}

