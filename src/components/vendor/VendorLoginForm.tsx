'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ProfileRoleRow = {
  role: string | null
}

const VENDOR_ROLES = new Set(['vendor', 'admin'])

export function VendorLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { signIn, refreshProfile, logout, userProfile } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const supabase = useMemo(() => {
    try {
      return getSupabaseClient()
    } catch (clientError) {
      console.error('Failed to initialise Supabase client for vendor login:', clientError)
      return null
    }
  }, [])

  const verifyVendorRole = async (): Promise<boolean> => {
    const profileRole = userProfile?.role?.toLowerCase()
    if (profileRole && VENDOR_ROLES.has(profileRole)) {
      return true
    }

    const refreshed = await refreshProfile().catch(() => null)
    const refreshedRole = refreshed?.role?.toLowerCase()
    if (refreshedRole && VENDOR_ROLES.has(refreshedRole)) {
      return true
    }

    if (supabase) {
      try {
        const { data: userData } = await supabase.auth.getSession()
        const uid = userData?.session?.user?.id
        if (uid) {
          const { data: roleRow, error: roleError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', uid)
            .maybeSingle<ProfileRoleRow>()

          if (!roleError) {
            const remoteRole = roleRow?.role?.toLowerCase()
            if (remoteRole && VENDOR_ROLES.has(remoteRole)) {
              return true
            }
          }
        }
      } catch (roleFetchError) {
        console.warn('Unable to verify vendor role via Supabase:', roleFetchError)
      }
    }

    return false
  }

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

      if (result.profile.role === 'owner') {
        await logout().catch(() => undefined)
        setError('Owner accounts cannot access the vendor portal. Please use the Downtown console instead.')
        toast({
          variant: 'warning',
          title: 'Use owner console',
          description: 'This email belongs to an owner account. You have been signed out here—continue via /downtown.',
        })
        return
      }

      const hasVendorAccess = await verifyVendorRole()
      if (!hasVendorAccess) {
        await logout().catch(() => undefined)
        setError(
          'This account is not registered as a vendor. Please request vendor access or use the customer portal.',
        )
        toast({
          variant: 'error',
          title: 'Vendor access required',
          description:
            'The email you entered belongs to a customer account. Sign into the regular experience or apply for vendor tools.',
        })
        return
      }

      toast({
        variant: 'success',
        title: 'Welcome back',
        description: 'Launching your vendor dashboard.',
      })
      router.push('/dashboard/vendor')
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
