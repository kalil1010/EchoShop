'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PostgrestError, User } from '@supabase/supabase-js'

import OwnerDashboardLayout from '@/components/owner/OwnerDashboardLayout'
import { getSupabaseClient } from '@/lib/supabaseClient'

type ProfileRole = { role: string | null }

type DashboardError = (Error & { code?: string }) | (PostgrestError & { stack?: string })

const PROFILE_TIMEOUT_MS = 30000

const normalizeRole = (value: string | null | undefined): string => value?.toLowerCase() ?? ''

const logProfileLoadError = (error: DashboardError, context: Record<string, unknown> = {}) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: error.message,
    code: 'code' in error ? error.code : undefined,
    stack: error.stack,
    context,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
  }

  console.error('[ProfileLoadError]', errorLog)
}

const getErrorMessage = (error: DashboardError) => {
  const message = (error.message || '').toLowerCase()

  if (
    message === 'profile_timeout' ||
    error.message === 'PROFILE_TIMEOUT' ||
    message.includes('profile loading timed out')
  ) {
    return {
      title: 'Connection Timeout',
      message:
        'Your profile is taking longer than expected to load. This may be due to a slow connection.',
      action: 'retry' as const,
    }
  }

  if ('code' in error && error.code === 'PGRST116') {
    return {
      title: 'Profile Not Found',
      message: 'Your profile could not be found. Please contact support.',
      action: 'contact' as const,
    }
  }

  if (message.includes('network')) {
    return {
      title: 'Network Error',
      message: 'Please check your internet connection and try again.',
      action: 'retry' as const,
    }
  }

  return {
    title: 'Unable to Load Dashboard',
    message: error.message || 'An unexpected error occurred.',
    action: 'retry' as const,
  }
}

const toDashboardError = (error: unknown): DashboardError => {
  if (error && typeof error === 'object' && 'message' in error) {
    return error as DashboardError
  }
  return new Error('Failed to load profile')
}

export default function OwnerDashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [, setProfile] = useState<ProfileRole | null>(null)
  const [error, setError] = useState<DashboardError | null>(null)

  useEffect(() => {
    let isMounted = true
    const supabase = getSupabaseClient()

    const loadUserAndProfile = async () => {
      let authUser: User | null = null

      try {
        const {
          data: { user: currentUser },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !currentUser) {
          router.replace('/auth')
          return
        }

        authUser = currentUser
        if (!isMounted) return

        const timeoutError = new Error('PROFILE_TIMEOUT')
        let timeoutId: ReturnType<typeof setTimeout> | undefined

        const profileRequest = supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single<ProfileRole>()

        const profileResponse = await new Promise<
          { data: ProfileRole | null; error: PostgrestError | null }
        >((resolve, reject) => {
          timeoutId = setTimeout(() => reject(timeoutError), PROFILE_TIMEOUT_MS)

          profileRequest.then(
            (result) => {
              clearTimeout(timeoutId)
              resolve(result)
            },
            (err) => {
              clearTimeout(timeoutId)
              reject(err)
            },
          )
        })

        if (profileResponse.error) {
          if (profileResponse.error.message === 'PROFILE_TIMEOUT') {
            throw new Error('Profile loading timed out. Please check your connection.')
          }
          throw profileResponse.error
        }

        const profileData = profileResponse.data
        const role = normalizeRole(profileData?.role)

        if (role !== 'owner') {
          if (role === 'vendor') {
            router.replace('/atlas/hub?from=owner-portal')
          } else {
            router.replace('/dashboard')
          }
          return
        }

        if (!isMounted) return

        setProfile(profileData)
        setIsLoading(false)
      } catch (err) {
        const dashboardError = toDashboardError(err)
        logProfileLoadError(dashboardError, {
          userId: authUser?.id ?? null,
          route: '/downtown/dashboard',
          attemptedAction: 'profile_load',
        })

        if (!isMounted) return
        setError(dashboardError)
        setIsLoading(false)
      }
    }

    loadUserAndProfile()

    return () => {
      isMounted = false
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    const errorInfo = getErrorMessage(error)

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-red-600 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">
            {errorInfo.title}
          </h2>
          <p className="text-gray-600 mb-6 text-center">{errorInfo.message}</p>
          <div className="space-y-3">
            {errorInfo.action === 'retry' && (
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
              >
                Retry
              </button>
            )}
            {errorInfo.action === 'contact' ? (
              <button
                onClick={() => (window.location.href = 'mailto:support@zmodaai.com')}
                className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition"
              >
                Contact Support
              </button>
            ) : (
              <button
                onClick={() => (window.location.href = '/auth')}
                className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition"
              >
                Return to Login
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <OwnerDashboardLayout>
      {/* Existing dashboard content rendered inside the layout */}
    </OwnerDashboardLayout>
  )
}
