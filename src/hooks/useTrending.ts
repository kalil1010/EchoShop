import { useState, useEffect } from 'react'
import type { Post } from '@/types/post'

interface TrendingHashtag {
  id: string
  name: string
  postCount: number
}

interface TrendingData {
  posts: Post[]
  hashtags: TrendingHashtag[]
}

interface UseTrendingOptions {
  postsLimit?: number
  hashtagsLimit?: number
  days?: number
  enabled?: boolean
}

export function useTrending(options: UseTrendingOptions = {}) {
  const {
    postsLimit = 20,
    hashtagsLimit = 10,
    days = 7,
    enabled = true,
  } = options

  const [data, setData] = useState<TrendingData>({ posts: [], hashtags: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    let cancelled = false

    const fetchTrending = async () => {
      try {
        setLoading(true)
        setError(null)

        const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData?.session?.access_token

        // Fetch trending posts and hashtags in parallel
        const [postsResponse, hashtagsResponse] = await Promise.all([
          fetch(`/api/posts?type=trending&limit=${postsLimit}`, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          }),
          fetch(`/api/hashtags/trending?days=${days}&limit=${hashtagsLimit}`, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          }),
        ])

        if (cancelled) return

        if (!postsResponse.ok && !hashtagsResponse.ok) {
          throw new Error('Failed to fetch trending content')
        }

        const postsData = postsResponse.ok ? await postsResponse.json() : { posts: [] }
        const hashtagsData = hashtagsResponse.ok ? await hashtagsResponse.json() : { hashtags: [] }

        if (cancelled) return

        setData({
          posts: postsData.posts || [],
          hashtags: hashtagsData.hashtags || [],
        })
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchTrending()

    return () => {
      cancelled = true
    }
  }, [enabled, postsLimit, hashtagsLimit, days])

  return { data, loading, error, refetch: () => {
    setLoading(true)
    // Trigger re-fetch by updating a dependency
  } }
}

