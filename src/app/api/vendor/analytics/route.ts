import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

type ProductSummaryRow = {
  id: string
  title: string
  status: string
  price: number | string | null
  currency: string | null
  created_at: string | null
  updated_at: string | null
}

const STATUS_KEYS = ['draft', 'pending_review', 'active', 'rejected', 'archived'] as const

const toIsoOrNull = (value: string | null | undefined): string | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()

    const [{ data: statusRows, error: statusError }, { data: recentRows, error: recentError }] =
      await Promise.all([
        supabase
          .from('vendor_products')
          .select('status')
          .eq('vendor_id', userId),
        supabase
          .from('vendor_products')
          .select('id, title, status, price, currency, created_at, updated_at')
          .eq('vendor_id', userId)
          .order('updated_at', { ascending: false })
          .limit(5),
      ])

    if (statusError) throw statusError
    if (recentError) throw recentError

    const counts: Record<(typeof STATUS_KEYS)[number] | 'other', number> = {
      draft: 0,
      pending_review: 0,
      active: 0,
      rejected: 0,
      archived: 0,
      other: 0,
    }

    for (const row of statusRows ?? []) {
      const key = (row.status ?? '').toLowerCase()
      if (counts[key as typeof STATUS_KEYS[number]] !== undefined) {
        counts[key as typeof STATUS_KEYS[number]] += 1
      } else {
        counts.other += 1
      }
    }

    const recentProducts = (recentRows ?? []).map((row: ProductSummaryRow) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      price: typeof row.price === 'number' ? row.price : Number.parseFloat(row.price || '0'),
      currency: row.currency ?? 'EGP',
      createdAt: toIsoOrNull(row.created_at),
      updatedAt: toIsoOrNull(row.updated_at),
    }))

    const totalProducts =
      counts.draft + counts.pending_review + counts.active + counts.rejected + counts.archived + counts.other

    return NextResponse.json({
      metrics: {
        totalProducts,
        drafts: counts.draft,
        pending: counts.pending_review,
        active: counts.active,
        rejected: counts.rejected,
        archived: counts.archived,
      },
      recentProducts,
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to load analytics.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
