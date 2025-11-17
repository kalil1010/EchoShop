import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError, sanitizeText } from '@/lib/security'
import { normaliseRole } from '@/lib/roles'

export const runtime = 'nodejs'

/**
 * GET /api/admin/support/tickets
 * Get all support tickets from vendors (for owner/admin)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    // Verify user is owner or admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle<{ role: string | null }>()

    if (profileError) {
      throw profileError
    }

    const role = normaliseRole(profile?.role)
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Owner or admin access required.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const status = searchParams.get('status') as string | null
    const priority = searchParams.get('priority') as string | null
    const vendorId = searchParams.get('vendorId') as string | null

    let query = supabase
      .from('vendor_owner_messages')
      .select('*')
      .eq('recipient_id', userId) // Messages sent to owner/admin
      .order('created_at', { ascending: false })

    // Filter by conversation if specified
    if (conversationId) {
      query = query.eq('conversation_id', conversationId)
    }

    // Filter by ticket status
    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      query = query.eq('ticket_status', status)
    }

    // Filter by priority
    if (priority && ['low', 'normal', 'high', 'urgent'].includes(priority)) {
      query = query.eq('ticket_priority', priority)
    }

    // Filter by vendor
    if (vendorId) {
      query = query.eq('sender_id', vendorId)
    }

    const { data: messages, error } = await query

    if (error) {
      throw error
    }

    // Group messages by conversation and get vendor info
    const conversationsMap = new Map<string, typeof messages>()
    const conversationMetadata = new Map<
      string,
      {
        lastMessage: (typeof messages)[0] | null
        unreadCount: number
        vendorId: string
        vendorName: string
        ticketStatus: string
        ticketPriority: string
        ticketCategory: string | null
      }
    >()

    if (messages) {
      for (const message of messages) {
        const convId = message.conversation_id
        if (!conversationsMap.has(convId)) {
          conversationsMap.set(convId, [])
        }
        conversationsMap.get(convId)!.push(message)

        // Track conversation metadata
        if (!conversationMetadata.has(convId)) {
          const vendorId = message.sender_id
          const { data: vendorProfile } = await supabase
            .from('profiles')
            .select('display_name, vendor_business_name')
            .eq('id', vendorId)
            .maybeSingle()

          conversationMetadata.set(convId, {
            lastMessage: message,
            unreadCount: 0,
            vendorId,
            vendorName: vendorProfile?.vendor_business_name || vendorProfile?.display_name || 'Vendor',
            ticketStatus: message.ticket_status || 'open',
            ticketPriority: message.ticket_priority || 'normal',
            ticketCategory: message.ticket_category || null,
          })
        }

        const metadata = conversationMetadata.get(convId)!
        if (message.created_at > (metadata.lastMessage?.created_at || '')) {
          metadata.lastMessage = message
          metadata.ticketStatus = message.ticket_status || metadata.ticketStatus
          metadata.ticketPriority = message.ticket_priority || metadata.ticketPriority
          metadata.ticketCategory = message.ticket_category || metadata.ticketCategory
        }
        if (!message.is_read && message.recipient_id === userId) {
          metadata.unreadCount++
        }
      }
    }

    const conversations = Array.from(conversationsMap.entries()).map(([id, msgs]) => ({
      id,
      messages: msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      ...conversationMetadata.get(id)!,
    }))

    return NextResponse.json({
      messages: conversationId ? conversations[0]?.messages || [] : [],
      conversations: !conversationId ? conversations : [],
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to fetch tickets.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/admin/support/tickets
 * Send a reply to a vendor support ticket
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    // Verify user is owner or admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle<{ role: string | null }>()

    if (profileError) {
      throw profileError
    }

    const role = normaliseRole(profile?.role)
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Owner or admin access required.' }, { status: 403 })
    }

    const payload = await request.json().catch(() => ({}))
    const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : null
    const message = typeof payload.message === 'string' ? payload.message.trim() : null
    const ticketStatus = typeof payload.ticketStatus === 'string' ? payload.ticketStatus : null
    const ticketPriority = typeof payload.ticketPriority === 'string' ? payload.ticketPriority : null

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required.' }, { status: 400 })
    }

    if (!message || message.length === 0) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'Message is too long (max 2000 characters).' }, { status: 400 })
    }

    // Get the first message in the conversation to find the vendor
    const { data: firstMessage, error: firstError } = await supabase
      .from('vendor_owner_messages')
      .select('sender_id, subject')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (firstError || !firstMessage) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
    }

    const vendorId = firstMessage.sender_id
    const subject = firstMessage.subject || 'Re: Support Request'

    const sanitizedMessage = sanitizeText(message, { maxLength: 2000, allowNewlines: true })

    // Insert reply message
    const { data: replyMessage, error: insertError } = await supabase
      .from('vendor_owner_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        recipient_id: vendorId,
        subject,
        message: sanitizedMessage,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (insertError) {
      throw insertError
    }

    // Update ticket status/priority if provided
    if (ticketStatus || ticketPriority) {
      const updateData: Record<string, unknown> = {}
      if (ticketStatus && ['open', 'in_progress', 'resolved', 'closed'].includes(ticketStatus)) {
        updateData.ticket_status = ticketStatus
        if (ticketStatus === 'resolved' || ticketStatus === 'closed') {
          updateData.resolved_at = new Date().toISOString()
          updateData.resolved_by = userId
        }
      }
      if (ticketPriority && ['low', 'normal', 'high', 'urgent'].includes(ticketPriority)) {
        updateData.ticket_priority = ticketPriority
      }

      if (Object.keys(updateData).length > 0) {
        // Update all messages in the conversation with new status/priority
        await supabase
          .from('vendor_owner_messages')
          .update(updateData)
          .eq('conversation_id', conversationId)
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: replyMessage,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to send reply:', error)
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to send reply.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

