import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { getSupabaseStorageConfig } from '@/lib/supabaseClient'
import { PermissionError, mapSupabaseError, sanitizeText } from '@/lib/security'
import { require2FAForAction, create2FARequiredResponse } from '@/lib/server/require2FA'
import { mapVendorProductRow } from '@/lib/vendorProducts'
import type { VendorProductStatus } from '@/types/vendor'

export const runtime = 'nodejs'

const STATUS_ALLOWLIST: Record<string, VendorProductStatus> = {
  draft: 'draft',
  pending_review: 'pending_review',
  active: 'active',
  rejected: 'rejected',
  archived: 'archived',
}

const normaliseStatus = (value: unknown): VendorProductStatus | undefined => {
  if (typeof value !== 'string') return undefined
  const key = value.toLowerCase()
  return STATUS_ALLOWLIST[key]
}

const parsePrice = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number.parseFloat(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

type ProductUpdatePayload = {
  title?: unknown
  description?: unknown
  currency?: unknown
  price?: unknown
  status?: unknown
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: productId } = await params
  if (!productId) {
    return NextResponse.json({ error: 'Missing product identifier.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    let payload: ProductUpdatePayload | null
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (payload.title !== undefined) {
      updates.title = sanitizeText(String(payload.title ?? ''), { maxLength: 120 })
    }
    if (payload.description !== undefined) {
      updates.description = sanitizeText(String(payload.description ?? ''), {
        maxLength: 2000,
        allowNewlines: true,
      })
    }
    if (payload.currency !== undefined) {
      updates.currency = String(payload.currency ?? '').trim().toUpperCase() || 'EGP'
    }
    if (payload.price !== undefined) {
      const parsedPrice = parsePrice(payload.price)
      if (parsedPrice === undefined) {
        return NextResponse.json({ error: 'Price must be a valid number.' }, { status: 400 })
      }
      updates.price = parsedPrice
    }
    if (payload.status !== undefined) {
      const status = normaliseStatus(payload.status)
      if (!status) {
        return NextResponse.json({ error: 'Invalid product status.' }, { status: 400 })
      }
      updates.status = status
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'No updatable fields were provided.' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('vendor_products')
      .update(updates)
      .eq('id', productId)
      .eq('vendor_id', userId)
      .select('*')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
    }

    const product = mapVendorProductRow(data)
    return NextResponse.json({ product })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to update product.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: productId } = await params
  if (!productId) {
    return NextResponse.json({ error: 'Missing product identifier.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { bucket } = getSupabaseStorageConfig()

  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    // Require 2FA for product deletion (critical action)
    const twoFAResult = await require2FAForAction(request, 'delete_product', { productId })
    if (twoFAResult.required && !twoFAResult.verified) {
      return create2FARequiredResponse(twoFAResult)
    }

    const { data: existing, error: fetchError } = await supabase
      .from('vendor_products')
      .select('primary_image_path, gallery_paths')
      .eq('id', productId)
      .eq('vendor_id', userId)
      .maybeSingle<{ primary_image_path: string | null; gallery_paths: string[] | null }>()

    if (fetchError) {
      throw fetchError
    }

    if (!existing) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('vendor_products')
      .delete()
      .eq('id', productId)
      .eq('vendor_id', userId)

    if (deleteError) {
      throw deleteError
    }

    const pathsToRemove = new Set<string>()
    if (existing.primary_image_path) {
      pathsToRemove.add(existing.primary_image_path)
    }
    if (Array.isArray(existing.gallery_paths)) {
      existing.gallery_paths.forEach((path) => {
        if (typeof path === 'string' && path.trim()) {
          pathsToRemove.add(path)
        }
      })
    }

    if (pathsToRemove.size) {
      try {
        await supabase.storage.from(bucket).remove(Array.from(pathsToRemove))
      } catch (storageError) {
        console.warn('Failed to cleanup vendor product assets:', storageError)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to delete product.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
