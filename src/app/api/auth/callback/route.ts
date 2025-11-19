import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Session } from '@supabase/supabase-js'

type CallbackPayload = {
  event: string
  session?: Session | null
  userProfile?: {
    uid: string
    role: string
    vendorStatus?: string | null
  } | null
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as CallbackPayload | null

  if (!payload || typeof payload.event !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createRouteHandlerClient({ cookies })
  const response = NextResponse.json({ success: true })

  try {
    switch (payload.event) {
      case 'SIGNED_IN':
      case 'TOKEN_REFRESHED':
        if (payload.session) {
          await supabase.auth.setSession(payload.session)
        }
        break
      case 'SIGNED_OUT':
        // Sign out from Supabase (clears session and cookies server-side)
        // This will automatically clear all Supabase-related cookies
        try {
          await supabase.auth.signOut()
        } catch (signOutError) {
          // CRITICAL: Suppress refresh token errors during sign out
          // These are expected when tokens are already expired/invalid
          const errorMessage = signOutError instanceof Error ? signOutError.message : String(signOutError)
          const errorCode = (signOutError as { code?: string })?.code
          const isRefreshTokenError = 
            errorCode === 'refresh_token_not_found' ||
            errorMessage.includes('Refresh Token Not Found') ||
            errorMessage.includes('refresh_token_not_found')
          
          if (!isRefreshTokenError) {
            // Only log non-refresh-token errors
            console.warn('[auth callback] Sign out error (non-critical):', signOutError)
          }
          // Silently continue - sign out is best-effort
        }
        break
      default:
        break
    }
  } catch (error) {
    // CRITICAL: Suppress refresh token errors - these are expected when tokens expire
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as { code?: string })?.code
    const isRefreshTokenError = 
      errorCode === 'refresh_token_not_found' ||
      errorMessage.includes('Refresh Token Not Found') ||
      errorMessage.includes('refresh_token_not_found') ||
      (error && typeof error === 'object' && '__isAuthError' in error && errorCode === 'refresh_token_not_found')
    
    if (isRefreshTokenError) {
      // Refresh token errors are expected - return success to prevent retries
      // The client-side will handle cleanup
      return NextResponse.json({ success: true, note: 'Token expired (expected)' })
    }
    
    // Only log non-refresh-token errors
    console.error('[auth callback] Failed to sync Supabase session:', error)
    return NextResponse.json({ error: 'Session sync failed' }, { status: 500 })
  }

  return response
}
