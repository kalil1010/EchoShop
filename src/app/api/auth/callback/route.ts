import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Session } from '@supabase/supabase-js'

type CallbackPayload = {
  event: string
  session?: Session | null
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
        await supabase.auth.signOut()
        break
      default:
        break
    }
  } catch (error) {
    console.error('[auth callback] Failed to sync Supabase session:', error)
    return NextResponse.json({ error: 'Session sync failed' }, { status: 500 })
  }

  return response
}
