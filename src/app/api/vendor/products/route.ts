import { NextRequest, NextResponse } from 'next/server'

import { moderateImageBuffer } from '@/lib/imageModeration'
import { analyzeGarmentWithMistral } from '@/lib/mistralVision'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { buildStoragePath, getSupabaseStorageConfig } from '@/lib/storage'
import { PermissionError, mapSupabaseError, sanitizeText } from '@/lib/security'
import { mapVendorProductRow } from '@/lib/vendorProducts'

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
    const { data, error } = await supabase
      .from('vendor_products')
      .select('*')
      .eq('vendor_id', userId)
      .order('updated_at', { ascending: false })

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

    const formData = await request.formData()
    const rawTitle = formData.get('title')
    const rawDescription = formData.get('description')
    const price = parsePrice(formData.get('price'))
    const currency = parseCurrency(formData.get('currency'))
    const imageFiles = gatherImageFiles(formData)

    const title = sanitizeText(typeof rawTitle === 'string' ? rawTitle : '', { maxLength: 120 })
    const description =
      typeof rawDescription === 'string'
        ? sanitizeText(rawDescription, { maxLength: 2000, allowNewlines: true })
        : ''

    if (!title) {
      return NextResponse.json({ error: 'Please provide a product title.' }, { status: 400 })
    }

    if (!imageFiles.length) {
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

    const status = moderationStatus === 'ok' ? 'active' : 'pending_review'
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
        primary_image_path: primaryImagePath,
        primary_image_url: primaryImageUrl,
        gallery_paths: galleryPaths,
        gallery_urls: galleryUrls,
        moderation_status: moderationStatus,
        moderation_message: moderationMessage,
        moderation_category: moderationCategory,
        moderation_reasons: moderationReasons,
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

