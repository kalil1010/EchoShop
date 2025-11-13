'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getDefaultRouteForRole, getPortalAccess, normaliseRole } from '@/lib/roles'
import { useToast } from '@/components/ui/toast'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles?: string[]
  redirectTo?: string
}

/**
 * RoleGuard component that redirects users to their appropriate dashboard
 * if they don't have access to the current page.
 * 
 * For customer pages, only 'user' role is allowed.
 * Vendors and owners are redirected to their respective dashboards.
 */
export function RoleGuard({ children, allowedRoles = ['user'], redirectTo }: RoleGuardProps) {
  const { userProfile, loading, user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (loading || !userProfile || !user) return

    const role = normaliseRole(userProfile.role)
    
    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(role)) {
      // User doesn't have access - redirect to their dashboard
      const destination = redirectTo || getDefaultRouteForRole(role)
      
      toast({
        variant: 'default',
        title: 'Redirected to your dashboard',
        description: `This page is only available to ${allowedRoles.join(' or ')} accounts.`,
      })
      
      router.replace(destination)
      return
    }
  }, [loading, userProfile, user, allowedRoles, redirectTo, router, toast])

  // Show loading while checking
  if (loading || !userProfile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
      </div>
    )
  }

  // Check if user has access
  const role = normaliseRole(userProfile?.role)
  if (!allowedRoles.includes(role)) {
    // Don't render children if user doesn't have access
    // The redirect will happen in useEffect
    return null
  }

  return <>{children}</>
}

