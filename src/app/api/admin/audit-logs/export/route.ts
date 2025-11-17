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

    // Build query (no pagination for export)
    let query = supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })

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

    const { data: logs, error } = await query

    if (error) throw error

    // Convert to CSV
    const headers = [
      'ID',
      'Admin Email',
      'Admin Role',
      'Action Type',
      'Action Category',
      'Description',
      'Reason',
      'Target Entity Type',
      'Target Entity ID',
      'IP Address',
      'User Agent',
      'Created At',
    ]

    const rows = (logs || []).map((log) => [
      log.id,
      log.admin_email || '',
      log.admin_role || '',
      log.action_type,
      log.action_category,
      log.description,
      log.reason || '',
      log.target_entity_type || '',
      log.target_entity_id || '',
      log.ip_address || '',
      log.user_agent || '',
      log.created_at,
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting audit logs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export audit logs' },
      { status: 500 }
    )
  }
}

