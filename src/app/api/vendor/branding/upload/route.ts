import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { getSupabaseStorageConfig } from '@/lib/supabaseClient'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()
    const { bucket, folder } = getSupabaseStorageConfig()
    const formData = await request.formData()

    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null // 'logo' or 'banner'

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    if (!type || !['logo', 'banner'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Must be "logo" or "banner".' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PNG, JPEG, or WebP image.' },
        { status: 400 },
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 },
      )
    }

    // Generate storage path
    const extension = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg'
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).slice(2, 8)
    const safeUserId = userId.replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'vendor'
    const fileName = `${type}-${timestamp}-${randomSuffix}.${extension}`
    const storagePath = [folder, 'vendor-branding', safeUserId, fileName].filter(Boolean).join('/')

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Delete old file if exists
    const { data: profile } = await supabase
      .from('profiles')
      .select(`${type === 'logo' ? 'vendor_logo_path' : 'vendor_banner_path'}`)
      .eq('id', userId)
      .maybeSingle<{ vendor_logo_path?: string | null; vendor_banner_path?: string | null }>()

    const oldPath = type === 'logo' ? profile?.vendor_logo_path : profile?.vendor_banner_path
    if (oldPath) {
      try {
        await supabase.storage.from(bucket).remove([oldPath])
      } catch (error) {
        console.warn('Failed to delete old branding file:', error)
        // Continue anyway
      }
    }

    // Upload to storage
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: true,
    })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath)
    const publicUrl = publicUrlData?.publicUrl

    if (!publicUrl) {
      return NextResponse.json({ error: 'Failed to generate public URL.' }, { status: 500 })
    }

    // Update profile with new logo/banner
    const updateField = type === 'logo' ? 'vendor_logo_url' : 'vendor_banner_url'
    const updatePathField = type === 'logo' ? 'vendor_logo_path' : 'vendor_banner_path'

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        [updateField]: publicUrl,
        [updatePathField]: storagePath,
      })
      .eq('id', userId)

    if (updateError) {
      // Try to clean up uploaded file
      try {
        await supabase.storage.from(bucket).remove([storagePath])
      } catch {
        // Ignore cleanup errors
      }
      throw updateError
    }

    return NextResponse.json({
      url: publicUrl,
      path: storagePath,
      message: `${type === 'logo' ? 'Logo' : 'Banner'} uploaded successfully.`,
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to upload file.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

