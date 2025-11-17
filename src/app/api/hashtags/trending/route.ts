import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError } from '@/lib/security'

// GET /api/hashtags/trending - Get trending hashtags
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 20)
    const days = parseInt(url.searchParams.get('days') || '7')

    // Use the database function for trending hashtags
    const { data, error } = await supabase.rpc('get_trending_hashtags', {
      days_count: days,
      limit_count: limit,
    })

    if (error) {
      // Fallback to simple query if function doesn't exist
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('hashtags')
        .select('id, name, post_count')
        .order('post_count', { ascending: false })
        .limit(limit)

      if (fallbackError) throw fallbackError

      return NextResponse.json({
        hashtags: (fallbackData || []).map((h) => ({
          id: h.id,
          name: h.name,
          postCount: h.post_count,
        })),
      })
    }

    return NextResponse.json({
      hashtags: (data || []).map((h: any) => ({
        id: h.hashtag_id,
        name: h.name,
        postCount: Number(h.post_count),
      })),
    })
  } catch (error) {
    console.error('[hashtags/trending] error:', error)
    return NextResponse.json({ error: 'Failed to fetch trending hashtags' }, { status: 500 })
  }
}

