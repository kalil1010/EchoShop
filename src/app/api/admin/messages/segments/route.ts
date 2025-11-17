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

    const { data: segments, error } = await supabase
      .from('vendor_segments')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ segments: segments || [] })
  } catch (error) {
    console.error('Error fetching segments:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch segments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { segment_name, description, criteria } = body

    if (!segment_name || !criteria) {
      return NextResponse.json(
        { error: 'Segment name and criteria are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('vendor_segments')
      .insert({
        segment_name,
        description: description || null,
        criteria,
        created_by: userId,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ segment: data })
  } catch (error) {
    console.error('Error creating segment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create segment' },
      { status: 500 }
    )
  }
}

