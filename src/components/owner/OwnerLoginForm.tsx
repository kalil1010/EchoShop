'use client'
import React, { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getDefaultRouteForRole, getPortalAccess, getRoleMeta, normaliseRole } from '@/lib/roles'
import type { PortalNotice } from '@/lib/roles'
import { PortalNoticeBanner } from '@/components/access/PortalNoticeBanner'

export function OwnerLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<PortalNotice | null>(null)
  const { signIn, logout, profileStatus, profileIssueMessage, isProfileFallback, refreshProfile } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [retryingProfile, setRetryingProfile] = useState(false)

  const handleProfileRetry = useCallback(async () => {
    setRetryingProfile(true)
    try {
      await refreshProfile()
      toast({
        variant: 'default',
        title: 'Retry requested',
        description: 'Attempting to sync your owner profile again. This may take a few seconds.',
      })
    } catch (refreshError) {
      const message =
        refreshError instanceof Error
          ? refreshError.message
          : 'Unable to retry profile sync. Please contact support.'
      toast({
        variant: 'error',
        title: 'Retry failed',
        description: message,
      })
    } finally {
      setRetryingProfile(false)
    }
  }, [refreshProfile, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      toast({ variant: 'destructive', title: 'Invalid email', description: 'Double-check your email format and try again.' })
      return
    }

    if (trimmedPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      toast({ variant: 'destructive', title: 'Invalid password', description: 'Passwords must be at least 8 characters.' })
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await signIn(trimmedEmail, trimmedPassword)
      
      const { profile, profileStatus: status, isProfileFallback: fallback, profileIssueMessage: issueMessage } = result
      const access = getPortalAccess(profile.role, 'owner')

      if (!access.allowed) {
        console.warn('[owner-login] access denied', {
          role: profile.role,
          denial: access.denial ?? null,
        })
        setNotice(access.denial?.banner ?? null)
        setError('Access denied. Please follow the guidance below.')

        const toastPayload = access.denial?.toast
        toast({
          variant: toastPayload?.variant ?? 'warning',
          title: toastPayload?.title ?? 'Access denied',
          description:
            toastPayload?.description ??
            'You do not have permission to access the owner console from this account.',
        })

        if (access.denial?.requiresLogout) {
          await logout().catch(() => undefined)
        }

        if (access.denial?.redirect) {
          router.replace(access.denial.redirect)
        }

        return
      }

      setNotice(null)

      if (status !== 'ready') {
        const message =
          issueMessage ??
          (fallback
            ? 'We could not validate your owner profile right now. Please retry profile sync or contact support.'
            : 'Your profile is still loading. Please wait a few seconds and try again.')
        setError(message)
        toast({
          variant: 'warning',
          title: 'Owner profile unavailable',
          description: message,
        })
        return
      }
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message : 'Failed to sign in'
      setError(message)
      toast({
        variant: 'error',
        title: 'Sign-in failed',
        description: message || 'Please check your credentials and try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Owner Login</CardTitle>
        <CardDescription>
          Access to Echo Shop Downtown is limited to verified owners.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notice ? <PortalNoticeBanner notice={notice} /> : null}
        {profileStatus !== 'ready' && profileIssueMessage && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Owner profile not available.</p>
            <p className="mt-1">{profileIssueMessage}</p>
            {isProfileFallback && (
              <p className="mt-1 text-amber-800">
                We&apos;re using a temporary profile, so access may be limited until sync completes.
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-3 border-amber-300 text-amber-900 hover:bg-amber-100"
              onClick={handleProfileRetry}
              disabled={retryingProfile}
            >
              {retryingProfile ? 'Retrying...' : 'Retry profile sync'}
            </Button>
          </div>
        )}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

