import { useState, useEffect } from 'react'

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

interface PostAnalytics {
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

interface UseUserAnalyticsOptions {
  userId?: string
  period?: 'all' | 'week' | 'month'
  enabled?: boolean
}

interface UsePostAnalyticsOptions {
  postId: string
  enabled?: boolean
}

export function useUserAnalytics(options: UseUserAnalyticsOptions = {}) {
  const { userId, period = 'all', enabled = true } = options

  const [data, setData] = useState<UserAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled || !userId) {
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)

        const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData?.session?.access_token

        if (!accessToken) {
          throw new Error('Session expired')
        }

        const response = await fetch(`/api/analytics/user?userId=${userId}&period=${period}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (cancelled) return

        if (!response.ok) {
          throw new Error('Failed to fetch user analytics')
        }

        const analyticsData = await response.json()

        if (cancelled) return

        setData(analyticsData)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchAnalytics()

    return () => {
      cancelled = true
    }
  }, [enabled, userId, period])

  return { data, loading, error, refetch: () => {
    setLoading(true)
    // Trigger re-fetch by updating a dependency
  } }
}

export function usePostAnalytics(options: UsePostAnalyticsOptions) {
  const { postId, enabled = true } = options

  const [data, setData] = useState<PostAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled || !postId) {
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)

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

        if (cancelled) return

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('You can only view analytics for your own posts')
          }
          throw new Error('Failed to fetch post analytics')
        }

        const analyticsData = await response.json()

        if (cancelled) return

        setData(analyticsData)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchAnalytics()

    return () => {
      cancelled = true
    }
  }, [enabled, postId])

  return { data, loading, error, refetch: () => {
    setLoading(true)
    // Trigger re-fetch by updating a dependency
  } }
}

