import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError } from '@/lib/server/errors'
import { PermissionError } from '@/lib/server/errors'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendorId')
    const productId = searchParams.get('productId')

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID is required.' }, { status: 400 })
    }

    // TODO: Create reviews table and fetch actual reviews
    // For now, return empty array
    const reviews: unknown[] = []

    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('Failed to fetch vendor reviews:', error)
    const mapped = mapSupabaseError(error)
    const message = mapped instanceof Error ? mapped.message : 'Unable to fetch reviews.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const payload = await request.json().catch(() => ({}))
    const vendorId = typeof payload.vendorId === 'string' ? payload.vendorId : null
    const productId = typeof payload.productId === 'string' ? payload.productId : null
    const rating = typeof payload.rating === 'number' ? payload.rating : null
    const comment = typeof payload.comment === 'string' ? payload.comment.trim() : null

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID is required.' }, { status: 400 })
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 })
    }

    if (!comment || comment.length === 0) {
      return NextResponse.json({ error: 'Review comment is required.' }, { status: 400 })
    }

    if (comment.length > 1000) {
      return NextResponse.json({ error: 'Review comment is too long (max 1000 characters).' }, { status: 400 })
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

    // TODO: Create reviews table and store review
    // For now, we'll return success and log the review
    console.log('[vendor/reviews] New review:', {
      userId,
      vendorId,
      productId,
      rating,
      comment,
      timestamp: new Date().toISOString(),
    })

    // In production, you would:
    // 1. Create a vendor_reviews table
    // 2. Check if user already reviewed (one review per user per vendor/product)
    // 3. Insert the review
    // 4. Update vendor/product average rating
    // 5. Send notification to vendor

    return NextResponse.json(
      {
        success: true,
        review: {
          id: 'temp-' + Date.now(),
          userId,
          vendorId,
          productId,
          rating,
          comment,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Failed to create vendor review:', error)
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to create review.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

