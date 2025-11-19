import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

const SubmitChallengeSchema = z.object({
  postId: z.string().uuid(),
})

// POST /api/challenges/[id]/submit - Submit to challenge
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id: challengeId } = await params
    const supabase = createServiceClient()

    const body = await request.json()
    const parsed = SubmitChallengeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { postId } = parsed.data

    // Verify challenge exists and is active
    const { data: challenge } = await supabase
      .from('challenges')
      .select('id, end_date, is_active')
      .eq('id', challengeId)
      .single()

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    if (!challenge.is_active) {
      return NextResponse.json({ error: 'Challenge is not active' }, { status: 400 })
    }

    if (new Date(challenge.end_date) < new Date()) {
      return NextResponse.json({ error: 'Challenge has ended' }, { status: 400 })
    }

    // Verify post exists and belongs to user
    const { data: post } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single()

    if (!post) {
      return NextResponse.json({ error: 'Post not found or unauthorized' }, { status: 404 })
    }

    // Check if already submitted
    const { data: existing } = await supabase
      .from('challenge_submissions')
      .select('id')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Already submitted to this challenge' }, { status: 400 })
    }

    // Create submission
    const { data: submission, error: submitError } = await supabase
      .from('challenge_submissions')
      .insert({
        challenge_id: challengeId,
        post_id: postId,
        user_id: userId,
      })
      .select()
      .single()

    if (submitError) throw submitError

    return NextResponse.json({ submission }, { status: 201 })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[challenges/submit] POST error:', error)
    return NextResponse.json({ error: 'Failed to submit to challenge' }, { status: 500 })
  }
}

