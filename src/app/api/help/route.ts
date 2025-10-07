import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 4

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('help_articles')
      .select('slug, title, body_md, video_url, updated_at')
      .order('updated_at', { ascending: false })
      .limit(Number.isFinite(limit) ? Math.max(limit, 1) : 4)

    if (error) {
      console.error('GET /api/help error', error)
      return NextResponse.json([], { status: 200 })
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('GET /api/help unexpected error', error)
    return NextResponse.json([], { status: 200 })
  }
}
