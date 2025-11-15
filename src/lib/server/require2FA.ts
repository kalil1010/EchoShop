/**
 * Server-side utilities to require 2FA verification for critical actions
 */

import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { is2FAEnabled, is2FARequired, get2FASession } from '@/lib/security/twoFactorAuth'
import type { CriticalActionType } from '@/lib/security/twoFactorAuth'
import { PermissionError } from '@/lib/security'

export interface Require2FAResult {
  required: boolean
  verified: boolean
  sessionToken?: string
  error?: string
}

/**
 * Check if 2FA is required and verified for a critical action
 * Returns result with sessionToken if verification is needed
 */
export async function require2FAForAction(
  request: NextRequest,
  actionType: CriticalActionType,
  actionContext?: Record<string, unknown>,
): Promise<Require2FAResult> {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    // Get user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle<{ role: string | null }>()

    const userRole = profile?.role as 'user' | 'vendor' | 'owner' | 'admin' | null

    // Check if 2FA is required
    const required = is2FARequired(userRole, 'critical_action', actionType)
    if (!required) {
      return { required: false, verified: true }
    }

    // Check if user has 2FA enabled
    const enabled = await is2FAEnabled(userId)
    if (!enabled) {
      return {
        required: true,
        verified: false,
        error: '2FA is required for this action but not enabled. Please enable 2FA in your security settings.',
      }
    }

    // Check for 2FA session token in request
    const sessionToken = request.headers.get('x-2fa-session-token') || request.headers.get('2fa-session-token')

    if (!sessionToken) {
      return {
        required: true,
        verified: false,
        error: '2FA verification required. Please provide a valid 2FA session token.',
      }
    }

    // Verify the session
    const session = await get2FASession(sessionToken)
    if (!session || !session.verified) {
      return {
        required: true,
        verified: false,
        error: 'Invalid or unverified 2FA session. Please complete 2FA verification.',
      }
    }

    if (session.userId !== userId) {
      return {
        required: true,
        verified: false,
        error: '2FA session does not match current user.',
      }
    }

    if (session.purpose !== 'critical_action' || session.actionType !== actionType) {
      return {
        required: true,
        verified: false,
        error: '2FA session does not match the requested action.',
      }
    }

    // Check if session expired
    if (new Date(session.expiresAt) < new Date()) {
      return {
        required: true,
        verified: false,
        error: '2FA session has expired. Please verify again.',
      }
    }

    return {
      required: true,
      verified: true,
      sessionToken: session.sessionToken,
    }
  } catch (error) {
    console.error('[require2FA] Error checking 2FA:', error)
    return {
      required: true,
      verified: false,
      error: 'Failed to verify 2FA status.',
    }
  }
}

/**
 * Create a NextResponse error for missing 2FA verification
 */
export function create2FARequiredResponse(result: Require2FAResult): NextResponse {
  if (result.verified) {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }

  return NextResponse.json(
    {
      error: result.error || '2FA verification required',
      requires2FA: true,
      action: 'verify_2fa',
    },
    { status: 403 },
  )
}

