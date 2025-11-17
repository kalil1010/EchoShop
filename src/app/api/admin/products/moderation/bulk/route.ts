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
    const { product_ids, action } = body

    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json({ error: 'Product IDs are required' }, { status: 400 })
    }

    if (!['approve', 'reject', 'archive'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    let updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (action === 'approve') {
      updateData.status = 'active'
      updateData.moderation_status = 'approved'
    } else if (action === 'reject') {
      updateData.status = 'rejected'
      updateData.moderation_status = 'rejected'
    } else if (action === 'archive') {
      updateData.status = 'archived'
    }

    const { error } = await supabase
      .from('vendor_products')
      .update(updateData)
      .in('id', product_ids)

    if (error) throw error

    // Log audit action
    await logAuditAction({
      adminId: userId,
      actionType: `bulk_product_${action}`,
      actionCategory: 'product',
      description: `Bulk ${action}: ${product_ids.length} products`,
      metadata: { count: product_ids.length, product_ids },
    })

    return NextResponse.json({ success: true, count: product_ids.length })
  } catch (error) {
    console.error('Error performing bulk action:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to perform bulk action' },
      { status: 500 }
    )
  }
}

