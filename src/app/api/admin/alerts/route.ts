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
    const severity = searchParams.get('severity')
    const vendorId = searchParams.get('vendor_id')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Check if alerts table exists - return empty array if it doesn't
    let query = supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }
    if (severity) {
      query = query.eq('severity', severity)
    }
    if (vendorId) {
      query = query.eq('vendor_id', vendorId)
    }

    const { data: alerts, error } = await query

    // If table doesn't exist (PGRST205), return empty array
    if (error) {
      const errorCode = (error as any)?.code
      if (errorCode === 'PGRST205' || errorCode === '42P01') {
        // Table doesn't exist - return empty array
        return NextResponse.json({ alerts: [] })
      }
      throw error
    }

    return NextResponse.json({ alerts: alerts || [] })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch alerts' },
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
      rule_id,
      alert_type,
      severity,
      title,
      description,
      vendor_id,
      related_entity_type,
      related_entity_id,
      metadata,
    } = body

    if (!rule_id || !alert_type || !severity || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Call database function to create alert
    const { data, error } = await supabase.rpc('create_alert', {
      p_rule_id: rule_id,
      p_alert_type: alert_type,
      p_severity: severity,
      p_title: title,
      p_description: description,
      p_vendor_id: vendor_id || null,
      p_related_entity_type: related_entity_type || null,
      p_related_entity_id: related_entity_id || null,
      p_metadata: metadata || null,
    })

    if (error) throw error

    return NextResponse.json({ success: true, alert_id: data })
  } catch (error) {
    console.error('Error creating alert:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create alert' },
      { status: 500 }
    )
  }
}

