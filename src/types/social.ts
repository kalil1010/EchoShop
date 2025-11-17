export interface Follow {
  followerId: string
  followingId: string
  createdAt: Date
}

export interface Like {
  id: string
  userId: string
  postId: string
  createdAt: Date
}

export interface Comment {
  id: string
  userId: string
  user?: {
    id: string
    displayName?: string
    photoURL?: string
  }
  postId: string
  parentId?: string
  content: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
  replies?: Comment[]
}

export interface CommentRow {
  id: string
  user_id: string
  post_id: string
  parent_id: string | null
  content: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  profiles?: {
    id: string
    display_name: string | null
    photo_url: string | null
  } | {
    id: string
    display_name: string | null
    photo_url: string | null
  }[] | null
}

export interface FollowStatus {
  isFollowing: boolean
  followerCount: number
  followingCount: number
}

export interface UserSocialStats {
  postsCount: number
  followersCount: number
  followingCount: number
}

