import type { OwnerAnalyticsSnapshot } from '@/components/owner/types'

const ANALYTICS_CACHE_TTL = 60000 // 1 minute
const ANALYTICS_CACHE_KEY = 'owner_analytics'

interface CachedAnalytics {
  metrics: OwnerAnalyticsSnapshot
  timestamp: number
}

export const analyticsCache = {
  get: (): OwnerAnalyticsSnapshot | null => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem(ANALYTICS_CACHE_KEY)
      if (!cached) return null
      
      const data = JSON.parse(cached) as CachedAnalytics
      
      // Validate TTL
      if (!data.timestamp || Date.now() - data.timestamp > ANALYTICS_CACHE_TTL) {
        sessionStorage.removeItem(ANALYTICS_CACHE_KEY)
        return null
      }
      
      return data.metrics
    } catch (e) {
      // Clear corrupted cache
      try {
        sessionStorage.removeItem(ANALYTICS_CACHE_KEY)
      } catch {
        // Ignore cleanup errors
      }
      return null
    }
  },
  
  set: (metrics: OwnerAnalyticsSnapshot): void => {
    if (typeof window === 'undefined') return
    try {
      const cacheData: CachedAnalytics = {
        metrics,
        timestamp: Date.now(),
      }
      sessionStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(cacheData))
    } catch (e) {
      // Storage quota or other error - silently fail
      console.debug('[analyticsCache] Failed to cache analytics (may be expected):', e)
    }
  },
  
  clear: (): void => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.removeItem(ANALYTICS_CACHE_KEY)
    } catch {
      // Ignore errors
    }
  },
}

