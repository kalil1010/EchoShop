'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { getDefaultRouteForRole, getRoleMeta } from '@/lib/roles'

interface LoginFormProps {
  onToggleMode: () => void
}

export function LoginForm({ onToggleMode }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = useMemo(() => {
    try {
      return getSupabaseClient()
    } catch (clientError) {
      console.error('Failed to initialise Supabase client for OAuth:', clientError)
      return null
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ variant: 'error', title: 'Invalid email', description: 'Double-check your email format and try again.' })
      return
    }

    if (trimmedPassword.length < 8) {
      toast({ variant: 'error', title: 'Invalid password', description: 'Passwords must be at least 8 characters.' })
      return
    }

    setLoading(true)

    try {
      const result = await signIn(trimmedEmail, trimmedPassword)
      const { profile, profileStatus, profileIssueMessage, isProfileFallback } = result
      const roleMeta = getRoleMeta(profile.role)
      const destination = getDefaultRouteForRole(profile.role)

      if (profileIssueMessage) {
        toast({
          variant: profileStatus === 'error' ? 'error' : 'warning',
          title:
            profileStatus === 'error'
              ? 'Profile sync is delayed'
              : 'Some profile data is still syncing',
          description: profileIssueMessage,
        })
      }

      if (isProfileFallback) {
        toast({
          variant: 'warning',
          title: 'Limited profile mode',
          description: 'We are loading the rest of your account details. Some features may be unavailable momentarily.',
        })
      }

      const greetingTitle = profile.displayName
        ? `Welcome back, ${profile.displayName}!`
        : roleMeta.welcomeTitle

      toast({
        variant: 'success',
        title: greetingTitle,
        description: roleMeta.welcomeSubtitle,
      })

      setTimeout(() => router.replace(destination), 800)
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message : 'Failed to sign in'
      toast({
        variant: 'error',
        title: 'Sign-in failed',
        description: message || 'Please check your credentials and try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    if (!supabase) {
      toast({
        variant: 'error',
        title: 'Google sign-in unavailable',
        description: 'Supabase client is not configured. Please try again later.',
      })
      return
    }

    setGoogleLoading(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google' })
      if (oauthError) {
        throw oauthError
      }
    } catch (oauthError) {
      const message = oauthError instanceof Error ? oauthError.message : 'Please try again.'
      console.error('Google sign-in failed:', oauthError)
      toast({
        variant: 'error',
        title: 'Google sign-in failed',
        description: message,
      })
      setGoogleLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Welcome back! Please sign in to your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
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
            <label htmlFor="password" className="text-sm font-medium">
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignUp}
            disabled={loading || googleLoading}
          >
            {googleLoading ? 'Redirecting...' : 'Sign in with Google'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={onToggleMode}
              className="text-sm text-blue-600 hover:underline"
            >
              Don&apos;t have an account? Sign up
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
