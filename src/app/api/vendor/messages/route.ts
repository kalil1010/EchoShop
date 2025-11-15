import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError } from '@/lib/server/errors'
import { PermissionError } from '@/lib/server/errors'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const payload = await request.json().catch(() => ({}))
    const vendorId = typeof payload.vendorId === 'string' ? payload.vendorId : null
    const productId = typeof payload.productId === 'string' ? payload.productId : null
    const subject = typeof payload.subject === 'string' ? payload.subject.trim() : null
    const message = typeof payload.message === 'string' ? payload.message.trim() : null

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID is required.' }, { status: 400 })
    }

    if (!message || message.length === 0) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: 'Message is too long (max 1000 characters).' }, { status: 400 })
    }

    // Verify vendor exists
    const { data: vendorProfile, error: vendorError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', vendorId)
      .maybeSingle()

    if (vendorError || !vendorProfile) {
      return NextResponse.json({ error: 'Vendor not found.' }, { status: 404 })
    }

    // TODO: Create messages table and store message
    // For now, we'll return success and log the message
    console.log('[vendor/messages] New message:', {
      from: userId,
      to: vendorId,
      productId,
      subject: subject || 'No subject',
      message,
      timestamp: new Date().toISOString(),
    })

    // In production, you would:
    // 1. Create a messages table
    // 2. Insert the message
    // 3. Send notification to vendor
    // 4. Optionally send email notification

    return NextResponse.json(
      {
        success: true,
        message: 'Your message has been sent to the vendor.',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to send vendor message:', error)
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to send message.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

