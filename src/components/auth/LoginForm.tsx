'use client'

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { getDefaultRouteForRole, getRoleMeta, getPortalAccess, normaliseRole } from '@/lib/roles'
import { AccessDeniedBanner } from './AccessDeniedBanner'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

interface LoginFormProps {
  onToggleMode: () => void
}

export function LoginForm({ onToggleMode }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState(false)
  const [turnstileLoadError, setTurnstileLoadError] = useState(false)
  const [turnstileLoading, setTurnstileLoading] = useState(true)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const turnstileErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { signIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  // Get redirect and role from URL params
  const redirectPath = searchParams.get('redirect') || null
  const wrongRole = searchParams.get('role') || null
  const missingProfile = searchParams.get('missingProfile') === 'true'
  
  // Determine portal from redirect path
  const portal = redirectPath?.startsWith('/downtown') 
    ? 'owner' 
    : redirectPath?.startsWith('/atlas') 
    ? 'vendor' 
    : 'customer'
  
  // Get access denial info if wrong role
  const accessDenial = wrongRole 
    ? getPortalAccess(normaliseRole(wrongRole), portal as 'owner' | 'vendor').denial
    : null
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

    // Validate CAPTCHA token if Turnstile is enabled and successfully loaded
    // If Turnstile failed to load (turnstileLoadError), allow proceeding without CAPTCHA
    // since Supabase CAPTCHA is disabled anyway
    if (hasTurnstile && !captchaToken && !turnstileLoadError) {
      toast({ 
        variant: 'error', 
        title: 'CAPTCHA required', 
        description: 'Please complete the CAPTCHA verification before signing in.' 
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
        console.log('Sign-in attempt with CAPTCHA:', {
          hasToken: !!captchaToken,
          tokenLength: captchaToken?.length || 0,
          tokenPrefix: captchaToken?.substring(0, 10) || 'none',
        })
      }
      
      const result = await signIn(trimmedEmail, trimmedPassword, captchaToken || undefined)
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

      // Use redirect path if provided, otherwise use role-based destination
      const finalDestination = redirectPath && 
        getPortalAccess(profile.role, portal as 'owner' | 'vendor').allowed
        ? redirectPath
        : destination

      setTimeout(() => router.replace(finalDestination), 800)
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message : 'Failed to sign in'
      
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
          title: 'Sign-in failed',
          description: message || 'Please check your credentials and try again.',
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
        {(accessDenial?.banner || missingProfile) && (
          <div className="mb-4">
            {accessDenial?.banner && (
              <AccessDeniedBanner notice={accessDenial.banner} />
            )}
            {missingProfile && !accessDenial?.banner && (
              <AccessDeniedBanner
                notice={{
                  tone: 'info',
                  title: 'Profile setup required',
                  description: 'Your account needs a profile to continue. Sign in to create your profile automatically.',
                }}
              />
            )}
          </div>
        )}
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
                    CAPTCHA widget failed to load. You can still sign in without CAPTCHA verification.
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

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || (hasTurnstile && !captchaToken && !turnstileLoadError)}
          >
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
