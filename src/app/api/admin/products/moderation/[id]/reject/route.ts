import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { logAuditAction } from '@/lib/auditLogger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id: productId } = await params

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
    const { reason } = body

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    // Get product before update
    const { data: product } = await supabase
      .from('vendor_products')
      .select('*')
      .eq('id', productId)
      .single()

    // Update product status
    const { data, error } = await supabase
      .from('vendor_products')
      .update({
        status: 'rejected',
        moderation_status: 'rejected',
        moderation_message: reason,
        moderation_reasons: [reason],
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single()

    if (error) throw error

    // Log audit action
    await logAuditAction({
      adminId: userId,
      actionType: 'product_reject',
      actionCategory: 'product',
      description: `Rejected product: ${product?.title || productId}`,
      reason,
      targetEntityType: 'product',
      targetEntityId: productId,
      beforeState: { status: product?.status },
      afterState: { status: 'rejected' },
    })

    return NextResponse.json({ product: data })
  } catch (error) {
    console.error('Error rejecting product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reject product' },
      { status: 500 }
    )
  }
}

