import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError } from '@/lib/security'
import { mapVendorRequestRow } from '@/lib/vendorRequests'
import type { VendorRequest } from '@/types/vendor'

export const runtime = 'nodejs'

type RequestRow = {
  id: string
  user_id: string
  status: string
  message: string | null
  admin_notes: string | null
  decided_at: string | null
  created_at: string | null
  updated_at: string | null
}

const MAX_PENDING_REQUESTS = 3

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const [{ data: profileRow }, { data: requestRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle<{ role: string | null }>(),
      supabase
        .from('vendor_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_PENDING_REQUESTS),
    ])

    const requests: VendorRequest[] = (requestRows ?? []).map(mapVendorRequestRow)

    return NextResponse.json({
      role: profileRow?.role ?? 'user',
      requests,
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Failed to load vendor request status.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const [{ data: profileRow }, { data: existingRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle<{ role: string | null }>(),
      supabase
        .from('vendor_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    const currentRole = profileRow?.role?.toLowerCase() ?? 'user'
    if (currentRole === 'vendor' || currentRole === 'admin') {
      return NextResponse.json(
        { error: 'This account already has vendor access.' },
        { status: 400 },
      )
    }

    if (existingRows && existingRows.length > 0) {
      const latest = mapVendorRequestRow(existingRows[0] as RequestRow)
      if (latest.status === 'pending') {
        return NextResponse.json(
          { error: 'A vendor application is already pending review.' },
          { status: 400 },
        )
      }
    }

    const body = await request.json().catch(() => ({})) as { message?: string }
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    const { data, error } = await supabase
      .from('vendor_requests')
      .insert({
        user_id: userId,
        message: message || null,
        status: 'pending',
      })
      .select('*')
      .single<RequestRow>()

    if (error) {
      throw error
    }

    return NextResponse.json({ request: mapVendorRequestRow(data) }, { status: 201 })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to submit vendor request.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
