export type PostPrivacyLevel = 'public' | 'followers' | 'private'

export interface PostImage {
  url: string
  path?: string
}

export interface PostEngagement {
  likesCount: number
  commentsCount: number
  userLiked: boolean
  userSaved: boolean
}

export interface OutfitData {
  items?: Array<{
    id: string
    name: string
    imageUrl?: string
    color?: string
    category?: string
  }>
  occasion?: string
  weather?: string
  styleNotes?: string
}

export interface Post {
  id: string
  userId: string
  user?: {
    id: string
    displayName?: string
    photoURL?: string
  }
  caption?: string
  images: PostImage[]
  outfitData?: OutfitData
  privacyLevel: PostPrivacyLevel
  vendorProductIds?: string[]
  hashtags?: string[]
  engagement: PostEngagement
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

export interface PostRow {
  id: string
  user_id: string
  caption: string | null
  images: string[] | null
  image_paths: string[] | null
  outfit_data: any | null
  privacy_level: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  profiles?: {
    id: string
    display_name: string | null
    photo_url: string | null
  } | null
}

export interface CreatePostInput {
  caption?: string
  images: File[]
  outfitData?: OutfitData
  privacyLevel?: PostPrivacyLevel
  vendorProductIds?: string[]
}

export interface UpdatePostInput {
  caption?: string
  privacyLevel?: PostPrivacyLevel
  vendorProductIds?: string[]
}

