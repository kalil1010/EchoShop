import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { mapSupabaseError, PermissionError, sanitizeText } from '@/lib/security'

export const runtime = 'nodejs'

/**
 * GET /api/vendor/messages
 * Get messages for the authenticated vendor (conversations with owner)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    // Get owner ID (users with role 'owner')
    // If multiple owners exist, get the first one
    const { data: ownerData, error: ownerError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'owner')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (ownerError || !ownerData) {
      // If no owner found, return empty (vendor can still send messages, they'll be stored)
      return NextResponse.json({ messages: [], conversations: [] })
    }

    const ownerId = ownerData.id

    let query = supabase
      .from('vendor_owner_messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    // Filter by conversation if specified
    if (conversationId) {
      query = query.eq('conversation_id', conversationId)
    } else {
      // Only get messages between vendor and owner
      query = query.or(`and(sender_id.eq.${userId},recipient_id.eq.${ownerId}),and(sender_id.eq.${ownerId},recipient_id.eq.${userId})`)
    }

    // Filter unread only if requested
    if (unreadOnly) {
      query = query.eq('is_read', false).eq('recipient_id', userId)
    }

    const { data: messages, error } = await query

    if (error) {
      throw error
    }

    // Group messages by conversation
    const conversationsMap = new Map<string, typeof messages>()
    const conversationMetadata = new Map<
      string,
      {
        lastMessage: (typeof messages)[0] | null
        unreadCount: number
        participantId: string
        participantName: string
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
          const otherUserId = message.sender_id === userId ? message.recipient_id : message.sender_id
          const { data: otherUser } = await supabase
            .from('profiles')
            .select('display_name, vendor_business_name')
            .eq('id', otherUserId)
            .maybeSingle()

          conversationMetadata.set(convId, {
            lastMessage: message,
            unreadCount: 0,
            participantId: otherUserId,
            participantName:
              otherUser?.vendor_business_name || otherUser?.display_name || 'Owner',
          })
        }

        const metadata = conversationMetadata.get(convId)!
        if (message.created_at > (metadata.lastMessage?.created_at || '')) {
          metadata.lastMessage = message
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
    const message = mapped instanceof Error ? mapped.message : 'Unable to fetch messages.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/vendor/messages
 * Send a message to the owner
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()
    const payload = await request.json().catch(() => ({}))
    const subject = typeof payload.subject === 'string' ? payload.subject.trim() : null
    const message = typeof payload.message === 'string' ? payload.message.trim() : null
    const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : null

    if (!message || message.length === 0) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'Message is too long (max 2000 characters).' }, { status: 400 })
    }

    // Get owner ID (first owner found)
    const { data: ownerData, error: ownerError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'owner')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (ownerError || !ownerData) {
      return NextResponse.json({ error: 'Owner not found. Please contact support.' }, { status: 404 })
    }

    const ownerId = ownerData.id

    // Get or create conversation ID
    let finalConversationId = conversationId
    if (!finalConversationId) {
      const { data: convData, error: convError } = await supabase.rpc('get_or_create_conversation', {
        p_user1_id: userId,
        p_user2_id: ownerId,
      })

      if (convError) {
        // Fallback: generate new conversation ID
        finalConversationId = crypto.randomUUID()
      } else {
        finalConversationId = convData as string
      }
    }

    const sanitizedMessage = sanitizeText(message, { maxLength: 2000, allowNewlines: true })
    const sanitizedSubject = subject ? sanitizeText(subject, { maxLength: 200 }) : null

    const { data, error } = await supabase
      .from('vendor_owner_messages')
      .insert({
        conversation_id: finalConversationId,
        sender_id: userId,
        recipient_id: ownerId,
        subject: sanitizedSubject,
        message: sanitizedMessage,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(
      {
        success: true,
        message: data,
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
