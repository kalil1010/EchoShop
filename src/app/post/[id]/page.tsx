'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Heart, MessageCircle, Bookmark, Share2, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/toast'
import type { Post } from '@/types/post'
import type { Comment } from '@/types/social'
import { formatDistanceToNow } from 'date-fns'

interface CommentWithReplies extends Comment {
  replies?: CommentWithReplies[]
}

export default function PostDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const postId = params.id as string

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<CommentWithReplies[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    if (!authLoading && user) {
      fetchPost()
      fetchComments()
    }
  }, [postId, user, authLoading])

  const fetchPost = async () => {
    try {
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) {
        throw new Error('Session expired')
      }

      const response = await fetch(`/api/posts/${postId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            variant: 'error',
            title: 'Post not found',
            description: 'This post may have been deleted or is private.',
          })
          router.push('/feed')
          return
        }
        throw new Error('Failed to fetch post')
      }

      const data = await response.json()
      setPost(data.post)
    } catch (error) {
      console.error('[PostDetail] Error fetching post:', error)
      toast({
        variant: 'error',
        title: 'Failed to load post',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    try {
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) return

      const response = await fetch(`/api/posts/${postId}/comments`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) return

      const data = await response.json()
      setComments(data.comments || [])
    } catch (error) {
      console.error('[PostDetail] Error fetching comments:', error)
    }
  }

  const handleLike = async () => {
    if (!post || !user) return

    try {
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) return

      const response = await fetch(`/api/posts/${postId}/like`, {
        method: post.engagement.userLiked ? 'DELETE' : 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to like post')
      }

      // Update local state
      setPost({
        ...post,
        engagement: {
          ...post.engagement,
          userLiked: !post.engagement.userLiked,
          likesCount: post.engagement.userLiked
            ? post.engagement.likesCount - 1
            : post.engagement.likesCount + 1,
        },
      })
    } catch (error) {
      console.error('[PostDetail] Error liking post:', error)
      toast({
        variant: 'error',
        title: 'Failed to like post',
        description: 'Please try again.',
      })
    }
  }

  const handleSave = async () => {
    if (!post || !user) return

    try {
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) return

      const response = await fetch('/api/save', {
        method: post.engagement.userSaved ? 'DELETE' : 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId }),
      })

      if (!response.ok) {
        throw new Error('Failed to save post')
      }

      // Update local state
      setPost({
        ...post,
        engagement: {
          ...post.engagement,
          userSaved: !post.engagement.userSaved,
        },
      })
    } catch (error) {
      console.error('[PostDetail] Error saving post:', error)
      toast({
        variant: 'error',
        title: 'Failed to save post',
        description: 'Please try again.',
      })
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !user || submittingComment) return

    setSubmittingComment(true)
    try {
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) return

      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: commentText.trim() }),
      })

      if (!response.ok) {
        throw new Error('Failed to post comment')
      }

      const data = await response.json()
      setComments((prev) => [...prev, data.comment])
      setCommentText('')

      // Update comment count
      if (post) {
        setPost({
          ...post,
          engagement: {
            ...post.engagement,
            commentsCount: post.engagement.commentsCount + 1,
          },
        })
      }

      toast({
        variant: 'success',
        title: 'Comment posted',
      })
    } catch (error) {
      console.error('[PostDetail] Error posting comment:', error)
      toast({
        variant: 'error',
        title: 'Failed to post comment',
        description: 'Please try again.',
      })
    } finally {
      setSubmittingComment(false)
    }
  }

  const renderComment = (comment: CommentWithReplies, depth = 0) => (
    <div key={comment.id} className={depth > 0 ? 'ml-8 mt-3' : 'mt-4'}>
      <div className="flex gap-3">
        {comment.user?.photoURL ? (
          <Image
            src={comment.user.photoURL}
            alt={comment.user.displayName || 'User'}
            width={32}
            height={32}
            className="rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-gray-500 text-xs">
              {(comment.user?.displayName || 'U')[0].toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{comment.user?.displayName || 'Anonymous'}</span>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{comment.content}</p>
          </div>
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              {comment.replies.map((reply) => renderComment(reply, depth + 1))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (authLoading || loading) {
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
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center space-y-3">
            <h2 className="text-xl font-semibold">Sign In Required</h2>
            <p className="text-gray-600">Please sign in to view this post.</p>
            <Button onClick={() => router.push('/auth')}>Go to Sign In</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center space-y-3">
            <h2 className="text-xl font-semibold">Post Not Found</h2>
            <p className="text-gray-600">This post may have been deleted or is private.</p>
            <Button onClick={() => router.push('/feed')}>Back to Feed</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasMultipleImages = post.images.length > 1
  const currentImage = post.images[currentImageIndex]

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image Section */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  )}
                  {currentImageIndex < post.images.length - 1 && (
                    <button
                      onClick={() => setCurrentImageIndex((prev) => prev + 1)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
                    >
                      <ArrowLeft className="h-5 w-5 rotate-180" />
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
        </div>

        {/* Content Section */}
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b">
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
            <div className="flex-1">
              <div className="font-semibold">{post.user?.displayName || 'Anonymous'}</div>
              <div className="text-xs text-gray-500">
                {formatDistanceToNow(post.createdAt, { addSuffix: true })}
              </div>
            </div>
          </div>

          {/* Caption */}
          {post.caption && (
            <div className="mb-4 pb-4 border-b">
              <div className="text-sm">
                <span className="font-semibold">{post.user?.displayName || 'Anonymous'}</span>{' '}
                <span>{post.caption}</span>
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="flex-1 overflow-y-auto mb-4">
            {comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No comments yet.</p>
                <p className="text-sm mt-1">Be the first to comment!</p>
              </div>
            ) : (
              <div>
                {comments.map((comment) => renderComment(comment))}
              </div>
            )}
          </div>

          {/* Engagement Bar */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-4">
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 ${
                  post.engagement.userLiked ? 'text-red-500' : 'text-gray-700'
                }`}
              >
                <Heart className={`h-6 w-6 ${post.engagement.userLiked ? 'fill-current' : ''}`} />
                <span className="text-sm font-medium">{post.engagement.likesCount}</span>
              </button>
              <button className="flex items-center gap-2 text-gray-700">
                <MessageCircle className="h-6 w-6" />
                <span className="text-sm font-medium">{post.engagement.commentsCount}</span>
              </button>
              <button
                onClick={handleSave}
                className={`ml-auto ${post.engagement.userSaved ? 'text-yellow-500' : 'text-gray-700'}`}
              >
                <Bookmark className={`h-6 w-6 ${post.engagement.userSaved ? 'fill-current' : ''}`} />
              </button>
              <button className="text-gray-700">
                <Share2 className="h-6 w-6" />
              </button>
            </div>

            {/* Comment Form */}
            <form onSubmit={handleSubmitComment} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={submittingComment}
              />
              <Button type="submit" disabled={!commentText.trim() || submittingComment}>
                {submittingComment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Post'
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

