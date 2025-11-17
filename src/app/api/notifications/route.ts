import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'
import type { Notification, NotificationRow } from '@/types/notification'

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true'

    let query = supabase
      .from('notifications')
      .select(`
        id,
        user_id,
        type,
        related_user_id,
        related_post_id,
        read,
        created_at,
        profiles:related_user_id (
          id,
          display_name,
          photo_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    const { data, error } = await query

    if (error) throw error

    const notifications: Notification[] = (data || []).map((row: NotificationRow) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      return {
        id: row.id,
        userId: row.user_id,
        type: row.type as Notification['type'],
        relatedUserId: row.related_user_id || undefined,
        relatedUser: profile ? {
          id: profile.id,
          displayName: profile.display_name || undefined,
          photoURL: profile.photo_url || undefined,
        } : undefined,
        relatedPostId: row.related_post_id || undefined,
        read: row.read,
        createdAt: new Date(row.created_at),
      }
    })

    return NextResponse.json({ notifications })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[notifications] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const body = await request.json()
    const notificationIds = body.notificationIds

    if (!Array.isArray(notificationIds)) {
      return NextResponse.json({ error: 'Invalid notificationIds' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .in('id', notificationIds)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[notifications] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}

