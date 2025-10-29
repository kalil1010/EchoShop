'use client'

import React, { useEffect, useState } from 'react'
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

  const { signIn, refreshProfile, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    setNotice(initialNotice?.banner ?? null)
  }, [initialNotice])

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
