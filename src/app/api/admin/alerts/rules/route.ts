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
    const type = searchParams.get('type')
    const active = searchParams.get('active')

    let query = supabase
      .from('alert_rules')
      .select('*')
      .order('created_at', { ascending: false })

    if (type) {
      query = query.eq('rule_type', type)
    }
    if (active !== null) {
      query = query.eq('is_active', active === 'true')
    }

    const { data: rules, error } = await query

    if (error) throw error

    return NextResponse.json({ rules: rules || [] })
  } catch (error) {
    console.error('Error fetching alert rules:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch alert rules' },
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
      rule_name,
      description,
      rule_type,
      conditions,
      auto_action,
      notification_recipients,
      severity,
      is_active,
    } = body

    if (!rule_name || !rule_type || !conditions || !severity) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('alert_rules')
      .insert({
        rule_name,
        description: description || null,
        rule_type,
        conditions,
        auto_action: auto_action || null,
        notification_recipients: notification_recipients || [],
        severity,
        is_active: is_active !== false,
        created_by: userId,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ rule: data })
  } catch (error) {
    console.error('Error creating alert rule:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create alert rule' },
      { status: 500 }
    )
  }
}

