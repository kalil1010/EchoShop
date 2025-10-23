'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from './toast'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
export function OwnerLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      toast({ variant: 'destructive', title: 'Invalid email', description: 'Double-check your email format and try again.' })
      return
    }
    if (trimmedPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      toast({ variant: 'destructive', title: 'Invalid password', description: 'Passwords must be at least 8 characters.' })
      return
    }
    setLoading(true)
    setError('')
    try {
      const { profile } = await signIn(trimmedEmail, trimmedPassword)
      if (profile.role !== 'owner') {
        await logout().catch(() => undefined)
        const guidance =
          profile.role === 'vendor'
            ? 'Please sign in via the vendor portal at /atlas.'
            : 'Please sign in via the customer portal at /auth.'
        throw new Error(
          `This portal is reserved for ZMODA owners. ${guidance}`,
        )
      }
      toast({
        variant: 'success',
        title: 'Signed in',
        description: `Welcome back${profile.displayName ? `, ${profile.displayName}` : ''}!`,
      })
      router.replace('/downtown/dashboard')
    } catch (unknownError) {
      const message =
        unknownError instanceof Error ? unknownError.message : 'Failed to sign in'
      setError(message)
      toast({
        variant: 'error',
        title: 'Sign-in failed',
        description: message || 'Please check your credentials and try again.',
      })
    } finally {
      setLoading(false)
    }
  }
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Owner Login</CardTitle>
        <CardDescription>
          Access to ZMODA Downtown is limited to verified owners.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
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
              placeholder="Enter your password"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
