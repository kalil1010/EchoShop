'use client'

import { useState, useCallback } from 'react'
import { useToast } from '@/components/ui/toast'
import type { CriticalActionType } from '@/lib/security/twoFactorAuth'

interface Use2FAVerificationResult {
  verify2FA: (actionType: CriticalActionType, actionContext?: Record<string, unknown>) => Promise<boolean>
  isVerifying: boolean
  sessionToken: string | null
}

/**
 * Hook to handle 2FA verification for critical actions
 * Returns a function that checks if 2FA is required and creates a session
 */
export function use2FAVerification(): Use2FAVerificationResult {
  const { toast } = useToast()
  const [isVerifying, setIsVerifying] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  const verify2FA = useCallback(
    async (actionType: CriticalActionType, actionContext?: Record<string, unknown>): Promise<boolean> => {
      setIsVerifying(true)
      try {
        // Check if 2FA is required
        const requireResponse = await fetch('/api/auth/2fa/require', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            purpose: 'critical_action',
            actionType,
            actionContext,
          }),
        })

        if (!requireResponse.ok) {
          const data = await requireResponse.json().catch(() => ({}))
          if (data.requires2FA) {
            // 2FA is required but not verified
            toast({
              variant: 'warning',
              title: '2FA Verification Required',
              description: 'This action requires 2FA verification. Please verify your identity.',
            })
            return false
          }
          throw new Error(data.error || 'Failed to check 2FA requirement')
        }

        const requireData = await requireResponse.json()
        if (!requireData.required) {
          // 2FA not required for this action
          return true
        }

        if (!requireData.enabled) {
          // 2FA required but not enabled
          toast({
            variant: 'warning',
            title: '2FA Required',
            description: 'Please enable 2FA in your security settings to perform this action.',
          })
          return false
        }

        // Store session token for verification
        setSessionToken(requireData.sessionToken)
        return false // Return false to indicate verification is needed
      } catch (error) {
        console.error('2FA verification check failed:', error)
        toast({
          variant: 'error',
          title: 'Verification Error',
          description: error instanceof Error ? error.message : 'Failed to verify 2FA status.',
        })
        return false
      } finally {
        setIsVerifying(false)
      }
    },
    [toast],
  )

  return {
    verify2FA,
    isVerifying,
    sessionToken,
  }
}

