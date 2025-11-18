'use client'

import React, { useState, useEffect } from 'react'
import { PostCard } from '@/components/post/PostCard'
import { PostCreator } from '@/components/post/PostCreator'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/toast'
import type { Post } from '@/types/post'

type FeedType = 'following' | 'discover' | 'trending'

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [feedType, setFeedType] = useState<FeedType>('following')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [showPostCreator, setShowPostCreator] = useState(false)

  const fetchPosts = async (reset = false) => {
    if (!user) return

    const currentOffset = reset ? 0 : offset
    if (loadingMore && !reset) return

    try {
      if (reset) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) {
        throw new Error('Session expired')
      }

      const response = await fetch(
        `/api/posts?type=${feedType}&limit=20&offset=${currentOffset}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch posts')
      }

      const data = await response.json()
      const newPosts = data.posts || []

      if (reset) {
        setPosts(newPosts)
        setOffset(newPosts.length)
      } else {
        setPosts((prev) => [...prev, ...newPosts])
        setOffset((prev) => prev + newPosts.length)
      }

      setHasMore(newPosts.length === 20)
    } catch (error) {
      console.error('[Feed] Error fetching posts:', error)
      toast({
        variant: 'error',
        title: 'Failed to load feed',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    if (user) {
      setOffset(0)
      setPosts([])
      fetchPosts(true)
    }
  }, [feedType, user])

  const handleLike = async (postId: string) => {
    try {
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) return

      const response = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        // Revert optimistic update
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  engagement: {
                    ...post.engagement,
                    userLiked: !post.engagement.userLiked,
                    likesCount: post.engagement.userLiked
                      ? post.engagement.likesCount - 1
                      : post.engagement.likesCount + 1,
                  },
                }
              : post
          )
        )
      }
    } catch (error) {
      console.error('[Feed] Error liking post:', error)
    }
  }

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev])
    setShowPostCreator(false)
  }

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchPosts(false)
    }
  }

  // IMPROVED: Show loading state while auth is completing
  // Don't immediately show "sign in" message on refresh
  if (authLoading && !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Sign in to view your feed</h1>
          <p className="text-gray-600">Please sign in to see posts from people you follow.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Feed</h1>
        <Button onClick={() => setShowPostCreator(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Post
        </Button>
      </div>

      {/* Feed Type Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setFeedType('following')}
          className={`px-4 py-2 font-medium ${
            feedType === 'following'
              ? 'border-b-2 border-purple-500 text-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Following
        </button>
        <button
          onClick={() => setFeedType('discover')}
          className={`px-4 py-2 font-medium ${
            feedType === 'discover'
              ? 'border-b-2 border-purple-500 text-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Discover
        </button>
        <button
          onClick={() => setFeedType('trending')}
          className={`px-4 py-2 font-medium ${
            feedType === 'trending'
              ? 'border-b-2 border-purple-500 text-purple-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Trending
        </button>
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No posts yet.</p>
          <Button onClick={() => setShowPostCreator(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first post
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onLike={handleLike} />
          ))}
          {hasMore && (
            <div className="flex justify-center py-4">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Post Creator Modal */}
      <PostCreator
        open={showPostCreator}
        onClose={() => setShowPostCreator(false)}
        onPostCreated={handlePostCreated}
      />
    </div>
  )
}

