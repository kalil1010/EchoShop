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
    const adminId = searchParams.get('admin_id')
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (adminId) {
      query = query.eq('admin_id', adminId)
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

    const { data: logs, error, count } = await query

    if (error) throw error

    // Get statistics
    const statsParams: Record<string, unknown> = {}
    if (adminId) statsParams.p_admin_id = adminId
    if (startDate) statsParams.p_start_date = startDate
    if (endDate) statsParams.p_end_date = endDate

    const { data: stats } = await supabase.rpc('get_audit_log_stats', statsParams)

    return NextResponse.json({
      logs: logs || [],
      has_more: count ? offset + limit < count : false,
      stats: stats || null,
    })
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch audit logs' },
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
      adminId,
      actionType,
      actionCategory,
      description,
      reason,
      beforeState,
      afterState,
      targetEntityType,
      targetEntityId,
      metadata,
      retentionDays,
    } = body

    if (!adminId || !actionType || !actionCategory || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get IP address and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      null
    const userAgent = request.headers.get('user-agent') || null

    // Call database function to create audit log
    const { data, error } = await supabase.rpc('create_audit_log', {
      p_admin_id: adminId,
      p_action_type: actionType,
      p_action_category: actionCategory,
      p_description: description,
      p_reason: reason || null,
      p_before_state: beforeState || null,
      p_after_state: afterState || null,
      p_target_entity_type: targetEntityType || null,
      p_target_entity_id: targetEntityId || null,
      p_metadata: metadata || null,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_retention_days: retentionDays || 2555, // 7 years default
    })

    if (error) throw error

    return NextResponse.json({ success: true, log_id: data })
  } catch (error) {
    console.error('Error creating audit log:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create audit log' },
      { status: 500 }
    )
  }
}

