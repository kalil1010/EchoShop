import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)

    // Verify user is admin/owner
    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('vendor_products')
      .select(`
        *,
        profiles:vendor_id (
          email,
          vendor_business_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: products, error } = await query

    if (error) throw error

    const formattedProducts = (products || []).map((product: any) => ({
      id: product.id,
      vendor_id: product.vendor_id,
      title: product.title,
      description: product.description,
      price: Number(product.price),
      currency: product.currency,
      status: product.status,
      primary_image_url: product.primary_image_url,
      moderation_status: product.moderation_status,
      moderation_message: product.moderation_message,
      moderation_reasons: product.moderation_reasons,
      created_at: product.created_at,
      vendor_name: product.profiles?.vendor_business_name,
    }))

    return NextResponse.json({ products: formattedProducts })
  } catch (error) {
    console.error('Error fetching moderation queue:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch moderation queue' },
      { status: 500 }
    )
  }
}

