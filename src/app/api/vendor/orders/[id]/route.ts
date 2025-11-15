import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

// Placeholder for order updates - this will need to be implemented when orders table exists
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await params
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const payload = await request.json().catch(() => ({}))
    const { status } = payload

    // TODO: Implement actual order status update once orders table is created
    // For now, return success
    return NextResponse.json({ ok: true, orderId, status })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to update order.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

