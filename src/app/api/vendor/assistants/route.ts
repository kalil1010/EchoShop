import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

interface AssistantRow {
  id: string
  vendor_id: string
  assistant_id: string
  assistant_role: string
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()

    const { data: assistants, error } = await supabase
      .from('vendor_assistants')
      .select('*')
      .eq('vendor_id', userId)
      .is('removed_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    // Fetch profile data for each assistant
    const assistantIds = (assistants as AssistantRow[] || []).map((a) => a.assistant_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', assistantIds.length > 0 ? assistantIds : ['00000000-0000-0000-0000-000000000000'])

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, { name: p.display_name, email: p.email }]),
    )

    const mapped = (assistants as AssistantRow[] || []).map((assistant) => {
      const profile = profileMap.get(assistant.assistant_id)
      return {
        id: assistant.id,
        assistantId: assistant.assistant_id,
        assistantName: profile?.name || null,
        assistantEmail: profile?.email || null,
        assistantRole: assistant.assistant_role,
        createdAt: assistant.created_at,
      }
    })

    return NextResponse.json({ assistants: mapped })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to load assistants.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

