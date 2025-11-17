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
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const params: Record<string, unknown> = {}
    if (vendorId) params.p_vendor_id = vendorId
    if (startDate) params.p_start_date = startDate
    if (endDate) params.p_end_date = endDate

    const { data: stats, error } = await supabase.rpc('get_vendor_activity_stats', params)

    if (error) throw error

    return NextResponse.json({ stats: stats || {} })
  } catch (error) {
    console.error('Error fetching activity stats:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch activity stats' },
      { status: 500 }
    )
  }
}

