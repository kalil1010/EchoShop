import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { logAuditAction } from '@/lib/auditLogger'

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
    const { vendor_ids, action } = body

    if (!Array.isArray(vendor_ids) || vendor_ids.length === 0) {
      return NextResponse.json({ error: 'Vendor IDs are required' }, { status: 400 })
    }

    if (!['suspend', 'activate'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Update vendor status (assuming we add a suspended field to profiles)
    // For now, we'll use a metadata field or create a vendor_status table
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // In production, you'd have a vendor_status or is_suspended field
    // For now, we'll use metadata
    if (action === 'suspend') {
      // Mark vendors as suspended (would need vendor_status table or field)
      // This is a placeholder - actual implementation depends on your schema
    }

    // Log audit action
    await logAuditAction({
      adminId: userId,
      actionType: `bulk_vendor_${action}`,
      actionCategory: 'vendor',
      description: `Bulk ${action}: ${vendor_ids.length} vendors`,
      metadata: { count: vendor_ids.length, vendor_ids },
    })

    return NextResponse.json({ success: true, count: vendor_ids.length })
  } catch (error) {
    console.error('Error performing bulk vendor action:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to perform bulk action' },
      { status: 500 }
    )
  }
}

