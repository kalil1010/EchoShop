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
    const vendorId = searchParams.get('vendor_id')
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('vendor_activity_log')
      .select(`
        *,
        profiles:vendor_id (
          email,
          vendor_business_name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (vendorId) {
      query = query.eq('vendor_id', vendorId)
    }
    if (category) {
      query = query.eq('action_category', category)
    }
    if (type) {
      query = query.eq('action_type', type)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: activities, error, count } = await query

    if (error) throw error

    // Get statistics
    const statsParams: Record<string, unknown> = {}
    if (vendorId) statsParams.p_vendor_id = vendorId
    if (startDate) statsParams.p_start_date = startDate
    if (endDate) statsParams.p_end_date = endDate

    const { data: stats } = await supabase.rpc('get_vendor_activity_stats', statsParams)

    // Format activities
    const formattedActivities = (activities || []).map((activity: any) => ({
      id: activity.id,
      vendor_id: activity.vendor_id,
      action_type: activity.action_type,
      action_category: activity.action_category,
      description: activity.description,
      related_entity_type: activity.related_entity_type,
      related_entity_id: activity.related_entity_id,
      metadata: activity.metadata,
      created_at: activity.created_at,
      vendor_name: activity.profiles?.vendor_business_name,
      vendor_email: activity.profiles?.email,
    }))

    return NextResponse.json({
      activities: formattedActivities,
      has_more: count ? offset + limit < count : false,
      stats: stats || null,
    })
  } catch (error) {
    console.error('Error fetching activity feed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch activity feed' },
      { status: 500 }
    )
  }
}

