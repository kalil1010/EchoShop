'use client'
import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
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
  const [turnstileLoadError, setTurnstileLoadError] = useState(false)
  const [turnstileLoading, setTurnstileLoading] = useState(true)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const turnstileErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    setTurnstileLoadError(false)
    setTurnstileLoading(false)
    // Clear any pending error timeout
    if (turnstileErrorTimeoutRef.current) {
      clearTimeout(turnstileErrorTimeoutRef.current)
      turnstileErrorTimeoutRef.current = null
    }
  }, [])

  const handleCaptchaError = useCallback((error?: string) => {
    setCaptchaToken(null)
    setCaptchaError(true)
    
    // Only log error once to reduce console noise
    // Error 400020 typically means domain not whitelisted or site key mismatch
    if (!turnstileLoadError) {
      console.warn('[Turnstile] CAPTCHA widget error:', error || 'Error 400020 - Check Cloudflare Turnstile configuration')
    }
    
    // Only set load error after a delay to allow for retry/recovery
    // This prevents false positives from transient network issues
    if (turnstileErrorTimeoutRef.current) {
      clearTimeout(turnstileErrorTimeoutRef.current)
    }
    
    turnstileErrorTimeoutRef.current = setTimeout(() => {
      // Only set load error if we still don't have a token after delay
      setTurnstileLoadError(true)
      setTurnstileLoading(false)
    }, 3000) // Wait 3 seconds before showing error
  }, [turnstileLoadError])

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken(null)
    setTurnstileLoadError(false) // Reset error state on expire
    console.warn('Turnstile CAPTCHA token expired - user will need to complete it again')
    // Show a subtle notification that CAPTCHA expired
    toast({
      variant: 'warning',
      title: 'CAPTCHA expired',
      description: 'Please complete the CAPTCHA verification again.',
    })
  }, [toast])
  
  // Reset Turnstile on mount/remount to allow retry
  useEffect(() => {
    if (hasTurnstile) {
      // Reset loading state when component mounts
      setTurnstileLoading(true)
      setTurnstileLoadError(false)
    }
    
    return () => {
      // Cleanup timeout on unmount
      if (turnstileErrorTimeoutRef.current) {
        clearTimeout(turnstileErrorTimeoutRef.current)
      }
    }
  }, [hasTurnstile])

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

    // Validate CAPTCHA token if Turnstile is enabled and successfully loaded
    // If Turnstile failed to load (turnstileLoadError), allow proceeding without CAPTCHA
    // since Supabase CAPTCHA is disabled anyway
    if (hasTurnstile && !captchaToken && !turnstileLoadError) {
      toast({ 
        variant: 'error', 
        title: 'CAPTCHA required', 
        description: 'Please complete the CAPTCHA verification before signing up.' 
      })
      setCaptchaError(true)
      return
    }
    
    // If Turnstile failed to load, log a warning but allow proceeding
    if (hasTurnstile && turnstileLoadError) {
      console.warn('Turnstile failed to load, proceeding without CAPTCHA (CAPTCHA is disabled in Supabase)')
    }

    setLoading(true)
    
    try {
      // Log CAPTCHA token status for debugging (don't log the actual token for security)
      if (hasTurnstile) {
        console.log('Sign-up attempt with CAPTCHA:', {
          hasToken: !!captchaToken,
          tokenLength: captchaToken?.length || 0,
          tokenPrefix: captchaToken?.substring(0, 10) || 'none',
        })
      }
      
      await signUp(trimmedEmail, trimmedPassword, trimmedDisplayName || undefined, captchaToken || undefined)

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
      
      // Check if error is related to CAPTCHA
      const errorMessage = message.toLowerCase()
      if (errorMessage.includes('captcha') || errorMessage.includes('turnstile')) {
        toast({
          variant: 'error',
          title: 'CAPTCHA verification failed',
          description: 'The CAPTCHA verification failed. Please refresh the page and try again. If the problem persists, check your Turnstile configuration in Supabase.',
        })
        // Reset CAPTCHA on error to allow retry
        if (hasTurnstile) {
          resetCaptcha()
        }
      } else {
        toast({ 
          variant: 'error', 
          title: 'Sign-up failed', 
          description: message || 'Please try again.' 
        })
        // Reset CAPTCHA on error to allow retry
        if (hasTurnstile) {
          resetCaptcha()
        }
      }
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
              {captchaError && !turnstileLoadError && (
                <div className="text-sm text-red-600 text-center">
                  <p>CAPTCHA verification failed. Please try again.</p>
                </div>
              )}
              {turnstileLoadError && (
                <div className="text-sm text-amber-600 text-center space-y-1">
                  <p>
                    CAPTCHA widget failed to load. You can still sign up without CAPTCHA verification.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTurnstileLoadError(false)
                      setTurnstileLoading(true)
                      setCaptchaError(false)
                      turnstileRef.current?.reset()
                    }}
                    className="text-xs underline mt-1 text-blue-600 hover:text-blue-800"
                  >
                    Retry loading CAPTCHA
                  </button>
                  <p className="text-xs mt-2 text-muted-foreground">
                    If the problem persists, check your Turnstile configuration. See{' '}
                    <a 
                      href="/docs/TURNSTILE_ERROR_400020_FIX.md" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      troubleshooting guide
                    </a>
                    .
                  </p>
                </div>
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
            disabled={loading || googleLoading || (hasTurnstile && !captchaToken && !turnstileLoadError)} 
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
