'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getDefaultRouteForRole, getPortalAccess, getRoleMeta } from '@/lib/roles'
import type { PortalDenial, PortalNotice } from '@/lib/roles'
import { PortalNoticeBanner } from '@/components/access/PortalNoticeBanner'

interface VendorLoginFormProps {
  initialNotice?: PortalDenial | null
}

export function VendorLoginForm({ initialNotice = null }: VendorLoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<PortalNotice | null>(
    initialNotice?.banner ?? null,
  )

  const { signIn, refreshProfile, logout, profileStatus, profileIssueMessage, isProfileFallback } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [retryingProfile, setRetryingProfile] = useState(false)

  useEffect(() => {
    setNotice(initialNotice?.banner ?? null)
  }, [initialNotice])

  const handleProfileRetry = useCallback(async () => {
    setRetryingProfile(true)
    try {
      await refreshProfile()
      toast({
        variant: 'default',
        title: 'Retry requested',
        description: 'Trying the profile sync again. This usually finishes within a few seconds.',
      })
    } catch (refreshError) {
      const message =
        refreshError instanceof Error
          ? refreshError.message
          : 'Unable to retry profile sync. Please contact support if this continues.'
      toast({
        variant: 'error',
        title: 'Retry failed',
        description: message,
      })
    } finally {
      setRetryingProfile(false)
    }
  }, [refreshProfile, toast])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)

    try {
      const result = await signIn(trimmedEmail, trimmedPassword)
      const refreshed = await refreshProfile().catch(() => result.profile)
      const activeProfile = refreshed ?? result.profile
      const access = getPortalAccess(activeProfile.role, 'vendor')

      if (!access.allowed) {
        console.warn('[vendor-login] access denied', {
          role: activeProfile.role,
          denial: access.denial ?? null,
        })
        setError('Access denied. Please use the recommended console below.')
        setNotice(access.denial?.banner ?? null)

        if (access.denial?.toast) {
          toast({
            variant: access.denial.toast.variant,
            title: access.denial.toast.title,
            description: access.denial.toast.description,
          })
        } else {
          toast({
            variant: 'warning',
            title: 'Access denied',
            description: 'You were signed out of the vendor console.',
          })
        }

        if (access.denial?.requiresLogout) {
          await logout().catch(() => undefined)
        }

        if (access.denial?.redirect) {
          router.replace(access.denial.redirect)
        }
        return
      }

      setNotice(null)
      const roleMeta = getRoleMeta(activeProfile.role)
      toast({
        variant: 'success',
        title: roleMeta.welcomeTitle,
        description: roleMeta.welcomeSubtitle,
      })
      if (result.profileStatus !== 'ready') {
        const message =
          result.profileIssueMessage ??
          (result.isProfileFallback
            ? 'We signed you in with a temporary vendor profile. Retry profile sync before continuing.'
            : 'We could not confirm your vendor profile yet. Please retry the sync in a moment.')
        setError(message)
        toast({
          variant: 'warning',
          title: 'Vendor profile pending',
          description: message,
        })
        return
      }
      router.push(getDefaultRouteForRole(activeProfile.role))
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message : 'Unable to sign in with those credentials.'
      setError(message)
      toast({
        variant: 'error',
        title: 'Vendor sign-in failed',
        description: message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle>Vendor Sign In</CardTitle>
        <CardDescription>
          Access your marketplace dashboard to upload products, track listings, and manage orders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {notice ? <PortalNoticeBanner notice={notice} /> : null}
          {profileStatus !== 'ready' && profileIssueMessage ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Vendor profile not ready.</p>
              <p className="mt-1">{profileIssueMessage}</p>
              {isProfileFallback ? (
                <p className="mt-1 text-amber-800">
                  We&apos;re using a temporary profile, so vendor tools may be limited until sync finishes.
                </p>
              ) : null}
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
          ) : null}

          <div className="space-y-2">
            <label htmlFor="vendor-email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              id="vendor-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@brand.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="vendor-password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <Input
              id="vendor-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Checking access…' : 'Sign in as vendor'}
          </Button>

          <div className="space-y-1 text-center text-sm text-muted-foreground">
            <p>
              Need a vendor account?{' '}
              <Link href="/auth" className="font-medium text-purple-600 hover:underline">
                Create one here
              </Link>
              .
            </p>
            <p>
              Already signed in as a customer?{' '}
              <Link href="/dashboard/vendor" className="font-medium text-purple-600 hover:underline">
                Request vendor access
              </Link>
              .
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
