import { getSupabaseClient, getSupabaseStorageConfig } from '@/lib/supabaseClient'

export interface StoragePathOptions {
  userId: string
  originalName: string
  folder?: string
}

export function buildStoragePath({ userId, originalName, folder }: StoragePathOptions): string {
  const sanitizedUser = userId.replace(/[^a-zA-Z0-9_-]/g, '') || 'anonymous'
  const timestamp = Date.now()
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const { folder: defaultFolder } = getSupabaseStorageConfig()
  const baseFolder = folder ?? defaultFolder
  const segments = [baseFolder, sanitizedUser, `${timestamp}-${safeName}`].filter(Boolean)
  return segments.join('/')
}

export function getPublicStorageUrl(storagePath: string): string {
  const supabase = getSupabaseClient()
  const { bucket } = getSupabaseStorageConfig()
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
  return data?.publicUrl ?? ''
}

export function getStorageBucket(): string {
  const { bucket } = getSupabaseStorageConfig()
  return bucket
}

export function normaliseStoragePath(pathValue?: string | null): string | undefined {
  if (!pathValue) return undefined
  return pathValue.replace(/^[\\/]+/, '')
}

export async function uploadToStorage(
  storagePath: string,
  file: Blob | File,
  options?: { contentType?: string; upsert?: boolean; cacheControl?: string }
) {
  const supabase = getSupabaseClient()
  const { bucket } = getSupabaseStorageConfig()
  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, {
    cacheControl: options?.cacheControl ?? '3600',
    upsert: options?.upsert ?? true,
    contentType: options?.contentType,
  })
  if (error) throw error
  return {
    storagePath,
    publicUrl: getPublicStorageUrl(storagePath),
  }
}

export async function removeFromStorage(storagePath: string) {
  const supabase = getSupabaseClient()
  const { bucket } = getSupabaseStorageConfig()
  const pathValue = normaliseStoragePath(storagePath)
  if (!pathValue) return
  const { error } = await supabase.storage.from(bucket).remove([pathValue])
  if (error) throw error
}
