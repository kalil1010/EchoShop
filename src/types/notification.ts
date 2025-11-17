export type NotificationType = 
  | 'follow' 
  | 'like' 
  | 'comment' 
  | 'reply' 
  | 'vendor_featured' 
  | 'challenge_invitation'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  relatedUserId?: string
  relatedUser?: {
    id: string
    displayName?: string
    photoURL?: string
  }
  relatedPostId?: string
  read: boolean
  createdAt: Date
}

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  related_user_id: string | null
  related_post_id: string | null
  read: boolean
  created_at: string
  profiles?: {
    id: string
    display_name: string | null
    photo_url: string | null
  } | null
}

