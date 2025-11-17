import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'

export async function GET(request: NextRequest) {
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

    const { data: templates, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ templates: templates || [] })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

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

    const bodyData = await request.json()
    const { template_name, subject, body, template_type, variables } = bodyData

    if (!template_name || !subject || !body || !template_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        template_name,
        subject,
        body,
        template_type,
        variables: variables || [],
        created_by: userId,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ template: data })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create template' },
      { status: 500 }
    )
  }
}

