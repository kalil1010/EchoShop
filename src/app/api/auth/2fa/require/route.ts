import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'
import { is2FAEnabled, is2FARequired, create2FASession } from '@/lib/security/twoFactorAuth'
import type { CriticalActionType } from '@/lib/security/twoFactorAuth'

export const runtime = 'nodejs'

/**
 * Check if 2FA is required and create a verification session if needed
 * Used before login completion or critical actions
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}))
    const purpose = (payload.purpose as 'login' | 'critical_action') || 'login'
    const actionType = payload.actionType as CriticalActionType | undefined
    const actionContext = payload.actionContext as Record<string, unknown> | undefined

    // For login, try to get userId from request body first (in case session isn't established yet)
    // For critical actions, always require authentication
    let userId: string | null = null
    if (purpose === 'login' && payload.userId) {
      userId = payload.userId as string
    } else {
      // Try to get authenticated user (for critical actions or if userId not provided)
      try {
        const resolved = await resolveAuthenticatedUser(request)
        userId = resolved.userId
      } catch (authError) {
        // If authentication fails and this is a login request, return error
        if (purpose === 'login') {
          return NextResponse.json(
            { error: 'Authentication required. Please provide userId in request body for login flow.' },
            { status: 401 }
          )
        }
        throw authError
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle<{ role: string | null }>()

    const userRole = profile?.role as 'user' | 'vendor' | 'owner' | 'admin' | null

    // Check if 2FA is required for this user and action
    const required = is2FARequired(userRole, purpose, actionType)
    if (!required) {
      return NextResponse.json({
        required: false,
        message: '2FA is not required for this action.',
      })
    }

    // Check if user has 2FA enabled
    const enabled = await is2FAEnabled(userId)
    if (!enabled) {
      return NextResponse.json(
        {
          required: true,
          enabled: false,
          message: '2FA is required but not enabled. Please enable 2FA in your security settings.',
        },
        { status: 403 },
      )
    }

    // Create 2FA verification session
    const session = await create2FASession(userId, purpose, actionType, actionContext)
    if (!session) {
      return NextResponse.json({ error: 'Failed to create 2FA session.' }, { status: 500 })
    }

    return NextResponse.json({
      required: true,
      enabled: true,
      sessionToken: session.sessionToken,
      purpose: session.purpose,
      actionType: session.actionType,
      expiresAt: session.expiresAt,
    })
  } catch (error) {
    console.error('Failed to check 2FA requirement:', error)
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to check 2FA requirement.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

