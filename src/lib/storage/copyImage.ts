/**
 * Utility function to copy images in Supabase storage
 * Used for product duplication
 */

import { createServiceClient } from '@/lib/supabaseServer'
import { getSupabaseStorageConfig } from '@/lib/supabaseClient'
import { buildStoragePath } from '@/lib/storage'

interface CopyImageResult {
  newPath: string
  newUrl: string
}

/**
 * Copy an image from one storage path to another
 */
export async function copyStorageImage(
  sourcePath: string,
  targetPath: string,
): Promise<CopyImageResult> {
  const supabase = createServiceClient()
  const { bucket } = getSupabaseStorageConfig()

  // Download the source image
  const { data: sourceData, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(sourcePath)

  if (downloadError || !sourceData) {
    throw new Error(`Failed to download source image: ${downloadError?.message || 'Unknown error'}`)
  }

  // Convert blob to buffer
  const arrayBuffer = await sourceData.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Determine content type from file extension
  const extension = sourcePath.split('.').pop()?.toLowerCase() || 'jpg'
  const contentType =
    extension === 'png'
      ? 'image/png'
      : extension === 'webp'
        ? 'image/webp'
        : 'image/jpeg'

  // Upload to new path
  const { error: uploadError } = await supabase.storage.from(bucket).upload(targetPath, buffer, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  })

  if (uploadError) {
    throw new Error(`Failed to upload copied image: ${uploadError.message}`)
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(targetPath)
  const newUrl = publicUrlData?.publicUrl || ''

  return {
    newPath: targetPath,
    newUrl,
  }
}

/**
 * Copy all images from an original product to a duplicate
 */
export async function copyProductImages(
  userId: string,
  originalPaths: {
    primaryImagePath?: string | null
    galleryPaths?: string[] | null
  },
): Promise<{
  primaryImagePath: string | null
  primaryImageUrl: string | null
  galleryPaths: string[]
  galleryUrls: string[]
}> {
  const { folder } = getSupabaseStorageConfig()
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).slice(2, 8)

  const galleryPaths: string[] = []
  const galleryUrls: string[] = []

  // Copy primary image
  let primaryImagePath: string | null = null
  let primaryImageUrl: string | null = null

  if (originalPaths.primaryImagePath) {
    const sourcePath = originalPaths.primaryImagePath
    const extension = sourcePath.split('.').pop() || 'jpg'
    const newFilename = `product-${timestamp}-${randomSuffix}.${extension}`
    const targetPath = buildStoragePath({
      userId,
      originalName: newFilename,
      folder: 'vendor-products',
    })

    try {
      const result = await copyStorageImage(sourcePath, targetPath)
      primaryImagePath = result.newPath
      primaryImageUrl = result.newUrl
      galleryPaths.push(result.newPath)
      galleryUrls.push(result.newUrl)
    } catch (error) {
      console.warn('Failed to copy primary image:', error)
      // Continue with other images
    }
  }

  // Copy gallery images
  if (originalPaths.galleryPaths && Array.isArray(originalPaths.galleryPaths)) {
    for (let i = 0; i < originalPaths.galleryPaths.length; i++) {
      const sourcePath = originalPaths.galleryPaths[i]
      if (!sourcePath || typeof sourcePath !== 'string') continue

      // Skip if this is the same as primary image (already copied)
      if (sourcePath === originalPaths.primaryImagePath) {
        continue
      }

      const extension = sourcePath.split('.').pop() || 'jpg'
      const newFilename = `product-${timestamp}-${randomSuffix}-${i + 1}.${extension}`
      const targetPath = buildStoragePath({
        userId,
        originalName: newFilename,
        folder: 'vendor-products',
      })

      try {
        const result = await copyStorageImage(sourcePath, targetPath)
        galleryPaths.push(result.newPath)
        galleryUrls.push(result.newUrl)
      } catch (error) {
        console.warn(`Failed to copy gallery image ${i + 1}:`, error)
        // Continue with other images
      }
    }
  }

  return {
    primaryImagePath,
    primaryImageUrl,
    galleryPaths,
    galleryUrls,
  }
}

