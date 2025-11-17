import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

// GET /api/search - Search posts, users, hashtags
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request).catch(() => ({ userId: null }))
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const query = url.searchParams.get('q')?.trim()
    const type = url.searchParams.get('type') || 'all' // all, posts, users, hashtags, products
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const results: any = {
      posts: [],
      users: [],
      hashtags: [],
      products: [],
    }

    // Search posts
    if (type === 'all' || type === 'posts') {
      const { data: posts } = await supabase
        .from('posts')
        .select(`
          id,
          user_id,
          caption,
          images,
          created_at,
          profiles:user_id (
            id,
            display_name,
            photo_url
          )
        `)
        .is('deleted_at', null)
        .eq('privacy_level', 'public')
        .textSearch('caption', query, { type: 'websearch', config: 'english' })
        .limit(limit)

      results.posts = (posts || []).map((p: any) => ({
        id: p.id,
        caption: p.caption,
        image: p.images?.[0],
        createdAt: p.created_at,
        user: p.profiles ? {
          id: p.profiles.id,
          displayName: p.profiles.display_name,
          photoURL: p.profiles.photo_url,
        } : null,
      }))
    }

    // Search users
    if (type === 'all' || type === 'users') {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, display_name, photo_url')
        .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(limit)

      results.users = (users || []).map((u: any) => ({
        id: u.id,
        displayName: u.display_name,
        photoURL: u.photo_url,
      }))
    }

    // Search hashtags
    if (type === 'all' || type === 'hashtags') {
      const { data: hashtags } = await supabase
        .from('hashtags')
        .select('id, name, post_count')
        .ilike('name', `%${query}%`)
        .order('post_count', { ascending: false })
        .limit(limit)

      results.hashtags = (hashtags || []).map((h: any) => ({
        id: h.id,
        name: h.name,
        postCount: h.post_count,
      }))
    }

    // Search products (vendor products)
    if (type === 'all' || type === 'products') {
      const { data: products } = await supabase
        .from('vendor_products')
        .select(`
          id,
          title,
          description,
          price,
          currency,
          primary_image_url,
          vendor_id,
          profiles:vendor_id (
            id,
            display_name
          )
        `)
        .eq('status', 'active')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(limit)

      results.products = (products || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        currency: p.currency,
        imageUrl: p.primary_image_url,
        vendor: p.profiles ? {
          id: p.profiles.id,
          displayName: p.profiles.display_name,
        } : null,
      }))
    }

    return NextResponse.json({ results })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[search] error:', error)
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 })
  }
}

