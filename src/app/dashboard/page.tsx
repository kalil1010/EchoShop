'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import { getDefaultRouteForRole } from '@/lib/roles'

// Helper to get cached route from sessionStorage
const getCachedRoute = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    const cached = sessionStorage.getItem('echoshop_route_cache')
    if (!cached) return null
    const data = JSON.parse(cached)
    // Only use if less than 30 seconds old (very fresh)
    if (data.timestamp && Date.now() - data.timestamp < 30000) {
      return data.route
    }
    sessionStorage.removeItem('echoshop_route_cache')
  } catch {
    // Ignore errors
  }
  return null
}

export default function DashboardPage() {
  const { userProfile, loading, roleMeta } = useAuth()
  const router = useRouter()
  const redirectedRef = useRef(false)
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (redirectedRef.current) return

    // CRITICAL: Check cache FIRST and redirect IMMEDIATELY if exists
    const cachedRoute = getCachedRoute()
    if (cachedRoute) {
      redirectedRef.current = true
      // Redirect immediately, don't wait for auth loading
      redirectTimeoutRef.current = setTimeout(() => {
        router.replace(cachedRoute)
      }, 0)
      return
    }

    // Only wait for auth if no cache exists
    if (loading) return

    // No user profile means not authenticated
    if (!userProfile) {
      redirectedRef.current = true
      redirectTimeoutRef.current = setTimeout(() => {
        router.replace('/auth/login')
      }, 0)
      return
    }

    // Calculate target route
    const targetRoute = roleMeta?.defaultRoute || getDefaultRouteForRole(userProfile.role)
    
    // CRITICAL: Set cache IMMEDIATELY and synchronously before redirect
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('echoshop_route_cache', JSON.stringify({
          route: targetRoute,
          timestamp: Date.now(),
        }))
        // Force synchronous write verification
        sessionStorage.getItem('echoshop_route_cache') // Verify write
      } catch (error) {
        console.warn('[DashboardPage] Failed to cache route:', error)
      }
    }

    redirectedRef.current = true
    redirectTimeoutRef.current = setTimeout(() => {
      router.replace(targetRoute)
    }, 0)
  }, [loading, userProfile?.role, roleMeta, router])

  // Return null immediately - no skeleton, no spinner
  // The redirect happens so fast it's imperceptible
  return null
}
