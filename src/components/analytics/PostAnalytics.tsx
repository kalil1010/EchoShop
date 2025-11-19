'use client'

import React, { useState, useEffect } from 'react'
import { X, Eye, Heart, MessageCircle, Bookmark, TrendingUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

interface PostAnalyticsData {
  postId: string
  analytics: {
    views: number
    likes: number
    comments: number
    saves: number
    totalEngagement: number
    engagementRate: number | null
    reach: number
    recentEngagement: {
      likes: number
      comments: number
      period: string
    }
    createdAt: string
  }
}

interface PostAnalyticsProps {
  postId: string
  open: boolean
  onClose: () => void
}

export function PostAnalytics({ postId, open, onClose }: PostAnalyticsProps) {
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<PostAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open && postId) {
      fetchAnalytics()
    }
  }, [open, postId])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) {
        throw new Error('Session expired')
      }

      const response = await fetch(`/api/analytics/post/${postId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('You can only view analytics for your own posts')
        }
        throw new Error('Failed to fetch analytics')
      }

      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('[PostAnalytics] Error fetching analytics:', error)
      toast({
        variant: 'error',
        title: 'Failed to load analytics',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Post Analytics</CardTitle>
            <CardDescription>Detailed performance metrics for this post</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !analytics ? (
            <div className="text-center py-12 text-gray-500">
              <p>No analytics data available.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Eye className="h-6 w-6 text-gray-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{analytics.analytics.views}</div>
                  <div className="text-xs text-gray-500 mt-1">Views</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Heart className="h-6 w-6 text-red-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{analytics.analytics.likes}</div>
                  <div className="text-xs text-gray-500 mt-1">Likes</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{analytics.analytics.comments}</div>
                  <div className="text-xs text-gray-500 mt-1">Comments</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Bookmark className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{analytics.analytics.saves}</div>
                  <div className="text-xs text-gray-500 mt-1">Saves</div>
                </div>
              </div>

              {/* Engagement Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics.analytics.totalEngagement}</div>
                    <p className="text-xs text-gray-500 mt-1">Likes + Comments</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analytics.analytics.engagementRate !== null
                        ? `${analytics.analytics.engagementRate}%`
                        : 'N/A'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Based on views</p>
                  </CardContent>
                </Card>
              </div>

              {/* Reach */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Reach
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.analytics.reach}</div>
                  <p className="text-xs text-gray-500 mt-1">Unique users who saw this post</p>
                </CardContent>
              </Card>

              {/* Recent Engagement */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Recent Engagement</CardTitle>
                  <CardDescription>Last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-lg font-semibold">
                        {analytics.analytics.recentEngagement.likes}
                      </div>
                      <p className="text-xs text-gray-500">Likes</p>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">
                        {analytics.analytics.recentEngagement.comments}
                      </div>
                      <p className="text-xs text-gray-500">Comments</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

