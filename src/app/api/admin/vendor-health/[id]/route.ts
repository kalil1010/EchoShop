import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id: vendorId } = await params

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

    // Get health score
    const { data, error } = await supabase
      .from('vendor_health_scores')
      .select('*')
      .eq('vendor_id', vendorId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - return null
        return NextResponse.json(null)
      }
      throw error
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching vendor health:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch vendor health' },
      { status: 500 }
    )
  }
}

