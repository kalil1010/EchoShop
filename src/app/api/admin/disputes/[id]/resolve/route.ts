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
    const { id: disputeId } = await params

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
    const { resolution, resolved_amount } = body

    if (!resolution) {
      return NextResponse.json({ error: 'Resolution is required' }, { status: 400 })
    }

    // Get dispute before update
    const { data: dispute } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', disputeId)
      .single()

    // Update dispute
    const { data, error } = await supabase
      .from('disputes')
      .update({
        status: 'resolved',
        resolution,
        resolved_amount: resolved_amount || null,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq('id', disputeId)
      .select()
      .single()

    if (error) throw error

    // Add timeline event
    await supabase.rpc('add_dispute_timeline_event', {
      p_dispute_id: disputeId,
      p_event_type: 'resolution',
      p_description: `Dispute resolved: ${resolution}`,
      p_actor_id: userId,
      p_actor_type: 'admin',
    })

    // Log audit action
    await logAuditAction({
      adminId: userId,
      actionType: 'dispute_resolve',
      actionCategory: 'vendor',
      description: `Resolved dispute: ${disputeId}`,
      reason: resolution,
      targetEntityType: 'dispute',
      targetEntityId: disputeId,
      beforeState: { status: dispute?.status },
      afterState: { status: 'resolved' },
    })

    return NextResponse.json({ dispute: data })
  } catch (error) {
    console.error('Error resolving dispute:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve dispute' },
      { status: 500 }
    )
  }
}

