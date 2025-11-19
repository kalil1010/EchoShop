'use client'

import React, { useState, useEffect } from 'react'
import { BarChart3, Heart, MessageCircle, Users, TrendingUp, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/toast'

interface UserAnalytics {
  userId: string
  period: string
  stats: {
    postsCount: number
    likesReceived: number
    commentsReceived: number
    followersGained: number
    totalFollowers: number
    totalFollowing: number
  }
}

export function AnalyticsDashboard() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'all' | 'week' | 'month'>('all')

  useEffect(() => {
    if (!authLoading && user) {
      fetchAnalytics()
    }
  }, [user, authLoading, period])

  const fetchAnalytics = async () => {
    if (!user) return

    try {
      setLoading(true)
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) {
        throw new Error('Session expired')
      }

      const response = await fetch(`/api/analytics/user?period=${period}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }

      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('[AnalyticsDashboard] Error fetching analytics:', error)
      toast({
        variant: 'error',
        title: 'Failed to load analytics',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-600">Please sign in to view your analytics.</p>
        </CardContent>
      </Card>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-600">No analytics data available.</p>
        </CardContent>
      </Card>
    )
  }

  const { stats } = analytics

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics</h2>
          <p className="text-gray-600">Track your social media performance</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'all'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'month'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'week'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posts</CardTitle>
            <BarChart3 className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.postsCount}</div>
            <p className="text-xs text-gray-500">Total posts created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Likes Received</CardTitle>
            <Heart className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.likesReceived}</div>
            <p className="text-xs text-gray-500">Total likes on your posts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comments Received</CardTitle>
            <MessageCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.commentsReceived}</div>
            <p className="text-xs text-gray-500">Total comments on your posts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Followers Gained</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.followersGained}</div>
            <p className="text-xs text-gray-500">
              New followers {period === 'all' ? 'ever' : `this ${period}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Followers</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFollowers}</div>
            <p className="text-xs text-gray-500">Current follower count</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Following</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFollowing}</div>
            <p className="text-xs text-gray-500">Accounts you follow</p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement Summary</CardTitle>
          <CardDescription>
            Overview of your content performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Engagement</span>
              <span className="text-lg font-semibold">
                {stats.likesReceived + stats.commentsReceived}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Average Engagement per Post</span>
              <span className="text-lg font-semibold">
                {stats.postsCount > 0
                  ? Math.round((stats.likesReceived + stats.commentsReceived) / stats.postsCount)
                  : 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

