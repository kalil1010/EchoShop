import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

const ReportPostSchema = z.object({
  postId: z.string().uuid(),
  reason: z.enum([
    'spam',
    'inappropriate',
    'harassment',
    'violence',
    'hate_speech',
    'false_information',
    'intellectual_property',
    'other',
  ]),
  description: z.string().max(500).optional(),
})

// POST /api/report/post - Report a post
export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const body = await request.json()
    const parsed = ReportPostSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { postId, reason, description } = parsed.data

    // Verify post exists
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .is('deleted_at', null)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if user already reported this post
    const { data: existingReport } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', userId)
      .eq('reported_post_id', postId)
      .maybeSingle()

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this post' },
        { status: 400 }
      )
    }

    // Create report (assuming reports table exists)
    // If table doesn't exist, this will need to be created in a migration
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        reporter_id: userId,
        reported_post_id: postId,
        reported_user_id: post.user_id,
        type: 'post',
        reason,
        description: description || null,
        status: 'pending',
      })
      .select()
      .single()

    if (reportError) {
      // If table doesn't exist, return a helpful error
      if (reportError.code === '42P01') {
        console.error('[report/post] Reports table does not exist. Please run migration to create it.')
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
    console.error('[report/post] POST error:', error)
    return NextResponse.json({ error: 'Failed to report post' }, { status: 500 })
  }
}

