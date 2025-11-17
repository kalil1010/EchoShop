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
        status: 'active',
        moderation_status: 'approved',
        moderation_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single()

    if (error) throw error

    // Log audit action
    await logAuditAction({
      adminId: userId,
      actionType: 'product_approve',
      actionCategory: 'product',
      description: `Approved product: ${product?.title || productId}`,
      targetEntityType: 'product',
      targetEntityId: productId,
      beforeState: { status: product?.status },
      afterState: { status: 'active' },
    })

    return NextResponse.json({ product: data })
  } catch (error) {
    console.error('Error approving product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve product' },
      { status: 500 }
    )
  }
}

