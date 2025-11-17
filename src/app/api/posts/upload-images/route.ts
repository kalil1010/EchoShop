import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { getSupabaseStorageConfig, buildStoragePath } from '@/lib/storage'
import { PermissionError, mapSupabaseError } from '@/lib/security'

export async function POST(request: NextRequest) {
  const uploadedPaths: string[] = []
  const uploadedUrls: string[] = []

  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()
    const { bucket } = getSupabaseStorageConfig()

    const formData = await request.formData()
    const imageFiles = Array.from(formData.getAll('images')).filter(
      (file): file is File => file instanceof File && file.size > 0
    )

    if (imageFiles.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    if (imageFiles.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 images allowed' }, { status: 400 })
    }

    // Upload each image
    for (const file of imageFiles) {
      const originalName = file.name || 'image.jpg'
      const storagePath = buildStoragePath({
        userId,
        originalName,
        folder: 'posts',
      })

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: file.type || 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        // Cleanup already uploaded files on error
        for (const path of uploadedPaths) {
          await supabase.storage.from(bucket).remove([path]).catch(() => {})
        }
        throw mapSupabaseError(uploadError)
      }

      uploadedPaths.push(storagePath)

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath)
      const publicUrl = publicUrlData?.publicUrl ?? ''
      uploadedUrls.push(publicUrl)
    }

    return NextResponse.json({
      images: uploadedUrls,
      imagePaths: uploadedPaths,
    })
  } catch (error) {
    // Cleanup on error
    const supabase = createServiceClient()
    const { bucket } = getSupabaseStorageConfig()
    for (const path of uploadedPaths) {
      await supabase.storage.from(bucket).remove([path]).catch(() => {})
    }

    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[posts/upload-images] error:', error)
    return NextResponse.json({ error: 'Failed to upload images' }, { status: 500 })
  }
}

