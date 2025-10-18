'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseClient } from '@/lib/supabaseClient'

interface SignUpFormProps {
  onToggleMode: () => void
}

export function SignUpForm({ onToggleMode }: SignUpFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const { signUp } = useAuth()
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
    const trimmedDisplayName = displayName.trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      toast({ variant: 'error', title: 'Invalid email', description: 'Double-check your email format and try again.' })
      return
    }

    if (trimmedPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      toast({ variant: 'error', title: 'Weak password', description: 'Passwords must be at least 8 characters.' })
      return
    }

    if (trimmedDisplayName.length > 80) {
      setError('Display name is too long.')
      toast({ variant: 'error', title: 'Display name too long', description: 'Please keep your display name under 80 characters.' })
      return
    }

    setLoading(true)
    setError('')

    try {
      await signUp(trimmedEmail, trimmedPassword, trimmedDisplayName || undefined)
      const name = trimmedDisplayName || trimmedEmail.split('@')[0] || 'there'
      setSuccess(`Account created successfully! Welcome, ${name}. Redirecting...`)
      toast({ variant: 'success', title: 'Account created', description: `Welcome, ${name}!` })
      setTimeout(() => router.push('/profile'), 1500)
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message : 'Failed to sign up'
      setError(message)
      toast({ variant: 'error', title: 'Sign-up failed', description: message || 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    if (!supabase) {
      toast({
        variant: 'error',
        title: 'Google sign-up unavailable',
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
      console.error('Google sign-up failed:', oauthError)
      toast({
        variant: 'error',
        title: 'Google sign-up failed',
        description: message,
      })
      setGoogleLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Join ZMODA AI to get personalized fashion recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="displayName" className="text-sm font-medium">
              Display Name (optional)
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

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
              placeholder="Create a password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
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
            {googleLoading ? 'Redirecting...' : 'Sign up with Google'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={onToggleMode}
              className="text-sm text-blue-600 hover:underline"
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
