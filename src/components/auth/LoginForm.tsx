'use client'

import React, { useMemo, useState, useRef, useCallback } from 'react'
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
  const turnstileRef = useRef<TurnstileInstance>(null)
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
  }, [])

  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(null)
    console.warn('[Turnstile] CAPTCHA widget error')
  }, [])

  const handleCaptchaExpire = useCallback(() => {
    setCaptchaToken(null)
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

    // Validate CAPTCHA token if Turnstile is enabled
    if (hasTurnstile && !captchaToken) {
      toast({ 
        variant: 'error', 
        title: 'CAPTCHA required', 
        description: 'Please complete the CAPTCHA verification before signing in.' 
      })
      return
    }

    setLoading(true)

    try {
      const result = await signIn(trimmedEmail, trimmedPassword, captchaToken || undefined)
      
      // CRITICAL: Check for 2FA requirement FIRST before processing profile
      const { 
        profile, 
        profileStatus, 
        profileIssueMessage, 
        isProfileFallback,
        requires2FA,           // ADD THIS
        twoFASessionToken      // ADD THIS
      } = result
      
      // ADD THIS ENTIRE BLOCK - Check for 2FA requirement FIRST
      if (requires2FA && twoFASessionToken) {
        console.debug('[LoginForm] 2FA required, showing verification modal')
        
        toast({
          variant: 'info',
          title: '2FA Verification Required',
          description: 'Please enter the 6-digit code from your authenticator app to complete sign-in.',
        })
        
        // Store 2FA session data in sessionStorage (will persist across page refreshes within same session)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('2fa_session_token', twoFASessionToken)
          sessionStorage.setItem('2fa_email', trimmedEmail)
          sessionStorage.setItem('2fa_password', trimmedPassword) // Store password to complete login after 2FA
          sessionStorage.setItem('2fa_purpose', 'login')
        }
        
        // Redirect to 2FA verification page
        setTimeout(() => router.replace('/auth/verify-2fa'), 800)
        return  // CRITICAL: Exit early, do NOT continue to profile processing
      }
      
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

      // Vendor users always go to vendor dashboard
      if (profile.role === 'vendor') {
        setTimeout(() => router.replace('/atlas'), 800)
        return
      }

      // Use redirect path if provided, otherwise use role-based destination
      const finalDestination = redirectPath && 
        getPortalAccess(profile.role, portal as 'owner' | 'vendor').allowed
        ? redirectPath
        : destination

      setTimeout(() => router.replace(finalDestination), 800)
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
      const { error: oauthError } = await supabase.auth.signInWithOAuth({ 
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      })
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
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || (hasTurnstile && !captchaToken)}
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
