import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'
import type { Comment, CommentRow } from '@/types/social'

const CreateCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().uuid().optional(),
})

// GET /api/posts/[id]/comments - Get comments for a post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        id,
        user_id,
        post_id,
        parent_id,
        content,
        created_at,
        updated_at,
        deleted_at,
        profiles:user_id (
          id,
          display_name,
          photo_url
        )
      `)
      .eq('post_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Organize comments into threads
    const topLevelComments: Comment[] = []
    const repliesMap = new Map<string, Comment[]>()

    for (const row of (comments || []) as CommentRow[]) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const comment: Comment = {
        id: row.id,
        userId: row.user_id,
        user: profile ? {
          id: profile.id,
          displayName: profile.display_name || undefined,
          photoURL: profile.photo_url || undefined,
        } : undefined,
        postId: row.post_id,
        parentId: row.parent_id || undefined,
        content: row.content,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }

      if (row.parent_id) {
        if (!repliesMap.has(row.parent_id)) {
          repliesMap.set(row.parent_id, [])
        }
        repliesMap.get(row.parent_id)!.push(comment)
      } else {
        topLevelComments.push(comment)
      }
    }

    // Attach replies to top-level comments
    const attachReplies = (comment: Comment): Comment => {
      const replies = repliesMap.get(comment.id) || []
      return {
        ...comment,
        replies: replies.map(attachReplies),
      }
    }

    const organizedComments = topLevelComments.map(attachReplies)

    return NextResponse.json({ comments: organizedComments })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[posts/comments] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

// POST /api/posts/[id]/comments - Create a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    const body = await request.json()
    const parsed = CreateCommentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { content, parentId } = parsed.data

    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .insert({
        user_id: userId,
        post_id: id,
        parent_id: parentId || null,
        content,
      })
      .select(`
        id,
        user_id,
        post_id,
        parent_id,
        content,
        created_at,
        updated_at,
        profiles:user_id (
          id,
          display_name,
          photo_url
        )
      `)
      .single()

    if (commentError) throw commentError

    const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles

    const responseComment: Comment = {
      id: comment.id,
      userId: comment.user_id,
      user: profile ? {
        id: profile.id,
        displayName: profile.display_name || undefined,
        photoURL: profile.photo_url || undefined,
      } : undefined,
      postId: comment.post_id,
      parentId: comment.parent_id || undefined,
      content: comment.content,
      createdAt: new Date(comment.created_at),
      updatedAt: new Date(comment.updated_at),
    }

    return NextResponse.json({ comment: responseComment }, { status: 201 })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[posts/comments] POST error:', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}

