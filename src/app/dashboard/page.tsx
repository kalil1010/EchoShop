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

  useEffect(() => {
    if (redirectedRef.current) return

    // Check cache FIRST without waiting for auth
    const cachedRoute = getCachedRoute()
    if (cachedRoute) {
      redirectedRef.current = true
      router.replace(cachedRoute) // Redirect immediately
      return
    }

    // Only then wait for auth if no cache
    if (loading) return

    // No user profile means not authenticated
    if (!userProfile) {
      redirectedRef.current = true
      router.replace('/auth/login')
      return
    }

    // Calculate target route
    const targetRoute = roleMeta?.defaultRoute || getDefaultRouteForRole(userProfile.role)
    
    // BEFORE router.replace() - set cache IMMEDIATELY
    if (targetRoute && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('echoshop_route_cache', JSON.stringify({
          route: targetRoute,
          timestamp: Date.now(),
        }))
      } catch (e) {
        // Ignore cache errors
      }
    }

    // NOW redirect
    redirectedRef.current = true
    router.replace(targetRoute)
  }, [loading, userProfile?.role, roleMeta, router])

  // Return null immediately - no skeleton, no spinner
  // The redirect happens so fast it's imperceptible
  return null
}
