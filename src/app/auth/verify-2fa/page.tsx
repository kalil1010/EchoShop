'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'

export default function Verify2FAPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const { signIn } = useAuth()

  // Load session data from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('2fa_session_token')
      const userEmail = sessionStorage.getItem('2fa_email')
      const userPassword = sessionStorage.getItem('2fa_password')
      
      if (!token || !userEmail) {
        toast({
          variant: 'error',
          title: 'Session Expired',
          description: 'Please sign in again.',
        })
        router.replace('/auth')
        return
      }
      
      setSessionToken(token)
      setEmail(userEmail)
      if (userPassword) {
        setPassword(userPassword)
      }
    }
  }, [router, toast])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      toast({
        variant: 'error',
        title: 'Invalid Code',
        description: 'Please enter a valid 6-digit code.',
      })
      return
    }

    if (!sessionToken || !email) {
      toast({
        variant: 'error',
        title: 'Session Lost',
        description: 'Please sign in again.',
      })
      router.replace('/auth')
      return
    }

    setLoading(true)

    try {
      // Call 2FA verification API endpoint for login
      const response = await fetch('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionToken,
          code,
          email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }

      // If verification successful and we have password, complete the login
      if (data.success && password) {
        toast({
          variant: 'success',
          title: '2FA Verified!',
          description: 'Completing sign-in...',
        })

        // Clear sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('2fa_session_token')
          sessionStorage.removeItem('2fa_email')
          sessionStorage.removeItem('2fa_password')
          sessionStorage.removeItem('2fa_purpose')
        }

        // Complete the login with the stored credentials
        try {
          const result = await signIn(email, password)
          
          // Redirect based on role
          const destination = result.profile.role === 'owner' || result.profile.role === 'admin'
            ? '/downtown/dashboard'
            : result.profile.role === 'vendor'
            ? '/atlas'
            : '/'
          
          setTimeout(() => router.replace(destination), 500)
        } catch (loginError) {
          const message = loginError instanceof Error ? loginError.message : 'Failed to complete sign-in'
          toast({
            variant: 'error',
            title: 'Sign-in Failed',
            description: message,
          })
        }
      } else if (data.success) {
        // Verification successful but no password stored - redirect to login
        toast({
          variant: 'success',
          title: '2FA Verified!',
          description: 'Please sign in again.',
        })

        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('2fa_session_token')
          sessionStorage.removeItem('2fa_email')
          sessionStorage.removeItem('2fa_password')
          sessionStorage.removeItem('2fa_purpose')
        }

        setTimeout(() => router.replace('/auth'), 800)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed'
      toast({
        variant: 'error',
        title: 'Verification Failed',
        description: message,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    toast({
      variant: 'default',
      title: 'Code Resent',
      description: 'Check your authenticator app for a new code.',
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Authentication Code
              </label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest"
                disabled={loading}
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || code.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm"
              onClick={handleResend}
              disabled={loading}
            >
              Didn't receive a code? Resend
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full text-sm"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('2fa_session_token')
                  sessionStorage.removeItem('2fa_email')
                  sessionStorage.removeItem('2fa_password')
                  sessionStorage.removeItem('2fa_purpose')
                }
                router.replace('/auth')
              }}
              disabled={loading}
            >
              Back to Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

