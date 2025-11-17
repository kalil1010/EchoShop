import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)

    // Verify user is admin/owner or service
    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    // Allow service role or admin/owner
    const isAuthorized = !profile || profile.role === 'admin' || profile.role === 'owner'
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const {
      vendorId,
      actionType,
      actionCategory,
      description,
      relatedEntityType,
      relatedEntityId,
      metadata,
    } = body

    if (!vendorId || !actionType || !actionCategory || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get IP address and user agent from request
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      null
    const userAgent = request.headers.get('user-agent') || null

    // Call database function to log activity
    const { data, error } = await supabase.rpc('log_vendor_activity', {
      p_vendor_id: vendorId,
      p_action_type: actionType,
      p_action_category: actionCategory,
      p_description: description,
      p_related_entity_type: relatedEntityType || null,
      p_related_entity_id: relatedEntityId || null,
      p_metadata: metadata || null,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
    })

    if (error) throw error

    return NextResponse.json({ success: true, log_id: data })
  } catch (error) {
    console.error('Error logging activity:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to log activity' },
      { status: 500 }
    )
  }
}

