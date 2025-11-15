import { NextRequest, NextResponse } from 'next/server'

import { moderateImageBuffer } from '@/lib/imageModeration'
import { analyzeGarmentWithMistral } from '@/lib/mistralVision'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { buildStoragePath } from '@/lib/storage'
import { PermissionError, mapSupabaseError, sanitizeText } from '@/lib/security'
import { mapVendorProductRow } from '@/lib/vendorProducts'
import { getSupabaseStorageConfig } from '@/lib/supabaseClient'

export const runtime = 'nodejs'

const PRODUCT_STORAGE_FOLDER = 'vendor-products'

const parsePrice = (value: FormDataEntryValue | null): number => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return 0
    const parsed = Number.parseFloat(trimmed)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (typeof value === 'number') {
    return value
  }
  return 0
}

const parseCurrency = (value: FormDataEntryValue | null): string => {
  if (typeof value !== 'string') return 'EGP'
  const trimmed = value.trim().toUpperCase()
  return trimmed || 'EGP'
}

const gatherImageFiles = (formData: FormData): File[] => {
  const images = formData.getAll('images').filter((entry): entry is File => entry instanceof File)
  const fallback = formData.get('image')
  if (fallback instanceof File) {
    images.push(fallback)
  }
  return images.filter((file) => file.size > 0)
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()
    
    // Parse pagination parameters from query string
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number.parseInt(searchParams.get('limit') || '100', 10), 500) // Max 500 items
    const offset = Math.max(Number.parseInt(searchParams.get('offset') || '0', 10), 0)

    let query = supabase
      .from('vendor_products')
      .select('*')
      .eq('vendor_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (offset > 0) {
      query = query.range(offset, offset + limit - 1)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const products = (data ?? []).map(mapVendorProductRow)
    return NextResponse.json({ products })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to load vendor products.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const { bucket } = getSupabaseStorageConfig()
  const uploadedPaths: string[] = []

  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    // Check if this is a JSON request (for duplication) or FormData (for new product)
    const contentType = request.headers.get('content-type') || ''
    let rawTitle: string | null = null
    let rawDescription: string | null = null
    let price = 0
    let currency = 'EGP'
    let imageFiles: File[] = []
    let duplicateFrom: string | null = null

    if (contentType.includes('application/json')) {
      // JSON request for duplication
      const payload = await request.json().catch(() => ({}))
      rawTitle = typeof payload.title === 'string' ? payload.title : null
      rawDescription = typeof payload.description === 'string' ? payload.description : null
      price = parsePrice(payload.price)
      currency = parseCurrency(payload.currency)
      duplicateFrom = typeof payload.duplicateFrom === 'string' ? payload.duplicateFrom : null

      // If duplicating, fetch the original product's images
      if (duplicateFrom) {
        const { data: originalProduct, error: fetchError } = await supabase
          .from('vendor_products')
          .select('gallery_paths, gallery_urls, primary_image_path, primary_image_url')
          .eq('id', duplicateFrom)
          .eq('vendor_id', userId)
          .maybeSingle()

        if (!fetchError && originalProduct) {
          // Note: We can't directly copy files, so we'll create the product with the same URLs
          // In a production system, you'd want to copy the actual files
          // For now, we'll create a draft without images and let the vendor add new ones
        }
      }
    } else {
      // FormData request for new product
      const formData = await request.formData()
      rawTitle = formData.get('title') as string | null
      rawDescription = formData.get('description') as string | null
      price = parsePrice(formData.get('price'))
      currency = parseCurrency(formData.get('currency'))
      imageFiles = gatherImageFiles(formData)
    }

    const title = sanitizeText(typeof rawTitle === 'string' ? rawTitle : '', { maxLength: 120 })
    const description =
      typeof rawDescription === 'string'
        ? sanitizeText(rawDescription, { maxLength: 2000, allowNewlines: true })
        : ''

    if (!title) {
      return NextResponse.json({ error: 'Please provide a product title.' }, { status: 400 })
    }

    // Images are required for new products, but optional for duplicates (vendor can add later)
    if (!duplicateFrom && !imageFiles.length) {
      return NextResponse.json({ error: 'Please attach at least one product image.' }, { status: 400 })
    }

    let moderationStatus: 'ok' | 'review' = 'ok'
    let moderationMessage: string | null = null
    let moderationCategory: string | null = null
    let moderationReasons: string[] | null = null

    let aiDescription: string | undefined
    let aiColors: Array<{ name: string; hex: string }> | undefined

    const galleryPaths: string[] = []
    const galleryUrls: string[] = []

    for (let index = 0; index < imageFiles.length; index += 1) {
      const file = imageFiles[index]
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const contentType = file.type || 'image/jpeg'
      const filename = file.name || `product-${Date.now()}.jpg`

      const moderationOutcome = await moderateImageBuffer(buffer, {
        filename,
        contentType,
      })

      if (!moderationOutcome.ok) {
        return NextResponse.json({ error: moderationOutcome.message }, { status: 400 })
      }

      if (index === 0) {
        const analysis = await analyzeGarmentWithMistral(buffer, contentType)
        if (analysis) {
          aiDescription = analysis.description || undefined
          aiColors = analysis.colors?.map((entry) => ({
            name: entry.name,
            hex: entry.hex,
          }))

          if (analysis.safety.status === 'blocked') {
            return NextResponse.json(
              { error: 'This product image was blocked by vision safety checks. Please choose another image.' },
              { status: 400 },
            )
          }

          if (analysis.safety.status === 'review') {
            moderationStatus = 'review'
            moderationMessage = analysis.safety.reasons.join('; ') || 'Product awaiting manual review.'
            moderationCategory = 'mistral-safety'
            moderationReasons = analysis.safety.reasons.length ? analysis.safety.reasons : null
          }
        }
      }

      const storagePath = buildStoragePath({
        userId,
        originalName: filename,
        folder: PRODUCT_STORAGE_FOLDER,
      })

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType,
        })

      if (uploadError) {
        throw uploadError
      }

      uploadedPaths.push(storagePath)
      galleryPaths.push(storagePath)

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath)
      galleryUrls.push(publicUrlData?.publicUrl ?? '')
    }

    const primaryImagePath = galleryPaths[0]
    const primaryImageUrl = galleryUrls[0] ?? ''

    // For duplicates, always create as draft
    const status = duplicateFrom ? 'draft' : moderationStatus === 'ok' ? 'active' : 'pending_review'
    const nowIso = new Date().toISOString()

    const { data, error } = await supabase
      .from('vendor_products')
      .insert({
        vendor_id: userId,
        title,
        description,
        price,
        currency,
        status,
        primary_image_path: primaryImagePath || null,
        primary_image_url: primaryImageUrl || null,
        gallery_paths: galleryPaths.length > 0 ? galleryPaths : [],
        gallery_urls: galleryUrls.length > 0 ? galleryUrls : [],
        moderation_status: duplicateFrom ? null : moderationStatus,
        moderation_message: duplicateFrom ? null : moderationMessage,
        moderation_category: duplicateFrom ? null : moderationCategory,
        moderation_reasons: duplicateFrom ? null : moderationReasons,
        ai_description: aiDescription ?? null,
        ai_colors: aiColors ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('*')
      .single()

    if (error) {
      throw error
    }

    const product = mapVendorProductRow(data)
    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Failed to create vendor product:', error)
    if (uploadedPaths.length) {
      try {
        const { bucket } = getSupabaseStorageConfig()
        await supabase.storage.from(bucket).remove(uploadedPaths)
      } catch (cleanupError) {
        console.warn('Failed to cleanup vendor product uploads:', cleanupError)
      }
    }

    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to create vendor product.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

