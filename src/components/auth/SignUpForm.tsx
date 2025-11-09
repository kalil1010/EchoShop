'use client'
import React, { useMemo, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

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
  const [profileLoading, setProfileLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState(false)
  const turnstileRef = useRef<TurnstileInstance>(null)

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

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
  const hasTurnstile = Boolean(turnstileSiteKey)

  const handleCaptchaSuccess = useCallback((token: string) => {
    setCaptchaToken(token)
    setCaptchaError(false)
  }, [])

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(null)
    setCaptchaError(true)
  }, [])

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken(null)
  }, [])

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null)
    setCaptchaError(false)
    turnstileRef.current?.reset()
  }, [])

  // Function to get user profile and redirect based on role
  const redirectBasedOnRole = async (userId: string) => {
    if (!supabase) {
      console.error('Supabase client not available for profile fetch')
      router.push('/profile') // fallback
      return
    }

    setProfileLoading(true)
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        // If profile doesn't exist or error, default to user role
        router.push('/profile')
        return
      }

      // Redirect based on role
      switch (profile?.role) {
        case 'vendor':
          router.push('/vendor/hub')
          break
        case 'owner':
          router.push('/downtown')
          break
        case 'user':
        default:
          router.push('/profile')
          break
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      // Default fallback
      router.push('/profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()
    const trimmedDisplayName = displayName.trim()

    // Clear previous states
    setError('')
    setSuccess('')
    setCaptchaError(false)

    // Validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      const errorMsg = 'Please enter a valid email address.'
      setError(errorMsg)
      toast({ 
        variant: 'error', 
        title: 'Invalid email', 
        description: 'Double-check your email format and try again.' 
      })
      return
    }

    if (trimmedPassword.length < 8) {
      const errorMsg = 'Password must be at least 8 characters long.'
      setError(errorMsg)
      toast({ 
        variant: 'error', 
        title: 'Weak password', 
        description: 'Passwords must be at least 8 characters.' 
      })
      return
    }

    if (trimmedDisplayName.length > 80) {
      const errorMsg = 'Display name is too long.'
      setError(errorMsg)
      toast({ 
        variant: 'error', 
        title: 'Display name too long', 
        description: 'Please keep your display name under 80 characters.' 
      })
      return
    }

    // Validate CAPTCHA token
    if (!captchaToken) {
      const errorMsg = 'Please complete the CAPTCHA verification.'
      setError(errorMsg)
      setCaptchaError(true)
      toast({ 
        variant: 'error', 
        title: 'CAPTCHA required', 
        description: 'Please complete the CAPTCHA verification before signing up.' 
      })
      return
    }

    setLoading(true)
    
    try {
      await signUp(trimmedEmail, trimmedPassword, trimmedDisplayName || undefined, captchaToken)

      const name = trimmedDisplayName || trimmedEmail.split('@')[0] || 'there'
      setSuccess(`Account created successfully! Welcome, ${name}. Redirecting...`)
      toast({
        variant: 'success',
        title: 'Account created',
        description: `Welcome, ${name}!`,
      })

      let resolvedUserId: string | null = null
      if (supabase) {
        const { data, error: currentUserError } = await supabase.auth.getUser()
        if (!currentUserError && data?.user?.id) {
          resolvedUserId = data.user.id
        }
      }

      if (resolvedUserId) {
        await redirectBasedOnRole(resolvedUserId)
      } else {
        router.push('/profile')
      }
    } catch (unknownError) {
      const message = unknownError instanceof Error ? unknownError.message : 'Failed to sign up'
      setError(message)
      // Reset CAPTCHA on error to allow retry
      resetCaptcha()
      toast({ 
        variant: 'error', 
        title: 'Sign-up failed', 
        description: message || 'Please try again.' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    if (!supabase) {
      const errorMsg = 'Supabase client is not configured. Please try again later.'
      setError(errorMsg)
      toast({
        variant: 'error',
        title: 'Google sign-up unavailable',
        description: errorMsg,
      })
      return
    }

    setGoogleLoading(true)
    setError('')
    
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({ 
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (oauthError) {
        throw oauthError
      }
      
      // OAuth redirect will handle the rest
    } catch (oauthError) {
      const message = oauthError instanceof Error ? oauthError.message : 'Google sign-up failed. Please try again.'
      setError(message)
      console.error('Google sign-up failed:', oauthError)
      toast({
        variant: 'error',
        title: 'Google sign-up failed',
        description: message,
      })
      setGoogleLoading(false)
    }
  }

  // Show loading state during profile fetch
  if (profileLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Setting up your dashboard...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Join Echo Shop to get personalized fashion recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}
        
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="displayName">
              Display Name (optional)
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              disabled={loading || googleLoading}
            />
          </div>
          
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
              disabled={loading || googleLoading}
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
              placeholder="Create a password"
              required
              disabled={loading || googleLoading}
            />
          </div>

          {hasTurnstile && (
            <div className="space-y-2">
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={turnstileSiteKey}
                  onSuccess={handleCaptchaSuccess}
                  onError={handleCaptchaError}
                  onExpire={handleCaptchaExpire}
                  options={{
                    theme: 'light',
                    size: 'normal',
                  }}
                />
              </div>
              {captchaError && (
                <p className="text-sm text-red-600 text-center">
                  CAPTCHA verification failed. Please try again.
                </p>
              )}
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            Interested in selling on Echo Shop Marketplace? Complete your account first, then visit the{' '}
            <Link className="text-purple-600 hover:underline" href="/vendor/hub">
              Vendor Hub
            </Link>
            {' '}to submit an application.
          </p>
          
          <Button 
            className="w-full" 
            disabled={loading || googleLoading || (hasTurnstile && !captchaToken)} 
            type="submit"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-border"></span>
            <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
            <span className="h-px flex-1 bg-border"></span>
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
              disabled={loading || googleLoading}
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
