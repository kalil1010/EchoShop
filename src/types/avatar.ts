export interface AvatarRenderRecord {
  userId: string
  storagePath: string
  publicUrl: string | null
  prompt: string
  purpose: string
  createdAt: string
}

export interface AvatarGalleryResponse {
  items: AvatarRenderRecord[]
}
