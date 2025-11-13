'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getDefaultRouteForRole } from '@/lib/roles'
import { getSupabaseClient } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const { userProfile, loading, session } = useAuth()
  const router = useRouter()
  const [syncing, setSyncing] = useState(true)

  // Handle OAuth callback - sync session to server immediately
  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const supabase = getSupabaseClient()
        
        // Get the session from the URL hash (OAuth callback)
        // Supabase automatically handles this, but we need to ensure it's synced to server
        const { data: { session: oauthSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.warn('[auth/callback] Error getting session:', sessionError)
        }

        if (oauthSession) {
          // Immediately sync session to server cookies
          try {
            await fetch('/api/auth/callback', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                event: 'SIGNED_IN',
                session: oauthSession,
              }),
            })
            console.debug('[auth/callback] Session synced to server')
          } catch (syncError) {
            console.warn('[auth/callback] Failed to sync session to server:', syncError)
          }
        }
      } catch (error) {
        console.error('[auth/callback] Error handling OAuth callback:', error)
      } finally {
        setSyncing(false)
      }
    }

    handleOAuthCallback()
  }, [])

  useEffect(() => {
    // Wait for both syncing and loading to complete
    if (syncing || loading) return

    if (!userProfile) {
      // If we have a session but no profile, wait a bit for profile to load
      if (session) {
        // Give profile time to load (up to 3 seconds)
        const timeoutId = setTimeout(() => {
          if (!userProfile) {
            router.replace('/auth')
          }
        }, 3000)
        return () => clearTimeout(timeoutId)
      }
      // No session and no profile, redirect to auth
      router.replace('/auth')
      return
    }

    // Vendor users always go to vendor dashboard
    if (userProfile.role === 'vendor') {
      router.replace('/atlas')
      return
    }

    // Other users go to their default route
    const destination = getDefaultRouteForRole(userProfile.role)
    router.replace(destination)
  }, [syncing, loading, userProfile, session, router])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600 mx-auto" />
        <p className="text-sm text-muted-foreground">
          {syncing ? 'Syncing session...' : 'Completing sign in...'}
        </p>
      </div>
    </div>
  )
}

