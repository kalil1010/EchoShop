import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

interface NotificationRow {
  id: string
  user_id: string
  type: 'moderation' | 'order' | 'payout' | 'message' | 'system'
  title: string
  message: string
  link: string | null
  metadata: Record<string, unknown> | null
  is_read: boolean
  read_at: string | null
  created_at: string
  expires_at: string | null
}

/**
 * GET /api/vendor/notifications
 * Get notifications for the authenticated vendor
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const type = searchParams.get('type') as NotificationRow['type'] | null
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10)

    let query = supabase
      .from('vendor_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100))

    // Filter by read status
    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    // Filter by type
    if (type && ['moderation', 'order', 'payout', 'message', 'system'].includes(type)) {
      query = query.eq('type', type)
    }

    // Filter out expired notifications
    query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())

    const { data: notifications, error } = await query

    if (error) {
      throw error
    }

    // Get unread count
    const { data: unreadCountData, error: countError } = await supabase.rpc(
      'get_unread_notification_count',
      { p_user_id: userId },
    )

    const unreadCount = countError ? 0 : (unreadCountData as number) || 0

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount,
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to fetch notifications.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/vendor/notifications
 * Create a notification (for internal use or admin)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()
    const payload = await request.json().catch(() => ({}))
    const type = payload.type as NotificationRow['type'] | null
    const title = typeof payload.title === 'string' ? payload.title.trim() : null
    const message = typeof payload.message === 'string' ? payload.message.trim() : null
    const link = typeof payload.link === 'string' ? payload.link.trim() : null
    const metadata = payload.metadata || null
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null

    if (!type || !['moderation', 'order', 'payout', 'message', 'system'].includes(type)) {
      return NextResponse.json({ error: 'Invalid notification type.' }, { status: 400 })
    }

    if (!title || title.length === 0) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
    }

    if (!message || message.length === 0) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
    }

    if (title.length > 200) {
      return NextResponse.json({ error: 'Title is too long (max 200 characters).' }, { status: 400 })
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: 'Message is too long (max 1000 characters).' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('vendor_notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        link,
        metadata,
        expires_at: expiresAt,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, notification: data }, { status: 201 })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to create notification.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

