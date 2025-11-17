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

    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ flags: flags || [] })
  } catch (error) {
    console.error('Error fetching feature flags:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch feature flags' },
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
    const {
      flag_key,
      flag_name,
      description,
      is_enabled,
      is_global,
      rollout_percentage,
      scheduled_enable_at,
      scheduled_disable_at,
    } = body

    if (!flag_key || !flag_name) {
      return NextResponse.json(
        { error: 'Flag key and name are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('feature_flags')
      .insert({
        flag_key,
        flag_name,
        description: description || null,
        is_enabled: is_enabled || false,
        is_global: is_global !== false,
        rollout_percentage: rollout_percentage || 100,
        scheduled_enable_at: scheduled_enable_at || null,
        scheduled_disable_at: scheduled_disable_at || null,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ flag: data })
  } catch (error) {
    console.error('Error creating feature flag:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create feature flag' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
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
    const { flag_id, ...updates } = body

    if (!flag_id) {
      return NextResponse.json(
        { error: 'Flag ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('feature_flags')
      .update({
        ...updates,
        updated_by: userId,
      })
      .eq('id', flag_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ flag: data })
  } catch (error) {
    console.error('Error updating feature flag:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update feature flag' },
      { status: 500 }
    )
  }
}

