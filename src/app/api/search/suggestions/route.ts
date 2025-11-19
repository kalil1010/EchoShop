import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

// GET /api/search/suggestions - Get search suggestions/autocomplete
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request).catch(() => ({ userId: null }))
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const query = url.searchParams.get('q')?.trim()
    const type = url.searchParams.get('type') || 'all' // all, users, hashtags
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 20)

    if (!query || query.length < 1) {
      return NextResponse.json({ suggestions: [] })
    }

    const suggestions: any[] = []

    // Search users
    if (type === 'all' || type === 'users') {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, display_name, photo_url')
        .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(limit)

      if (users) {
        suggestions.push(
          ...users.map((u: any) => ({
            type: 'user',
            id: u.id,
            displayName: u.display_name,
            photoURL: u.photo_url,
            label: u.display_name || u.email,
          }))
        )
      }
    }

    // Search hashtags
    if (type === 'all' || type === 'hashtags') {
      const { data: hashtags } = await supabase
        .from('hashtags')
        .select('id, name, post_count')
        .ilike('name', `%${query}%`)
        .order('post_count', { ascending: false })
        .limit(limit)

      if (hashtags) {
        suggestions.push(
          ...hashtags.map((h: any) => ({
            type: 'hashtag',
            id: h.id,
            name: h.name,
            postCount: h.post_count,
            label: `#${h.name}`,
          }))
        )
      }
    }

    // Sort by relevance (exact matches first, then by popularity)
    suggestions.sort((a, b) => {
      const aExact = a.label?.toLowerCase().startsWith(query.toLowerCase())
      const bExact = b.label?.toLowerCase().startsWith(query.toLowerCase())
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      if (a.type === 'hashtag' && b.type === 'hashtag') {
        return (b.postCount || 0) - (a.postCount || 0)
      }
      return 0
    })

    return NextResponse.json({ suggestions: suggestions.slice(0, limit) })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[search/suggestions] error:', error)
    return NextResponse.json({ error: 'Failed to get suggestions' }, { status: 500 })
  }
}

