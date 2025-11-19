import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

const ReportUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.enum([
    'spam',
    'harassment',
    'impersonation',
    'inappropriate_content',
    'fake_account',
    'other',
  ]),
  description: z.string().max(500).optional(),
})

// POST /api/report/user - Report a user
export async function POST(request: NextRequest) {
  try {
    const { userId: reporterId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const body = await request.json()
    const parsed = ReportUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { userId: reportedUserId, reason, description } = parsed.data

    if (reporterId === reportedUserId) {
      return NextResponse.json(
        { error: 'Cannot report yourself' },
        { status: 400 }
      )
    }

    // Verify user exists
    const { data: reportedUser, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', reportedUserId)
      .single()

    if (userError || !reportedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user already reported this user
    const { data: existingReport } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', reporterId)
      .eq('reported_user_id', reportedUserId)
      .maybeSingle()

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this user' },
        { status: 400 }
      )
    }

    // Create report (assuming reports table exists)
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        type: 'user',
        reason,
        description: description || null,
        status: 'pending',
      })
      .select()
      .single()

    if (reportError) {
      // If table doesn't exist, return a helpful error
      if (reportError.code === '42P01') {
        console.error('[report/user] Reports table does not exist. Please run migration to create it.')
        return NextResponse.json(
          { error: 'Reporting system not yet configured' },
          { status: 503 }
        )
      }
      throw reportError
    }

    return NextResponse.json(
      { success: true, reportId: report.id },
      { status: 201 }
    )
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[report/user] POST error:', error)
    return NextResponse.json({ error: 'Failed to report user' }, { status: 500 })
  }
}

