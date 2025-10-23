export type UserRole = 'user' | 'vendor' | 'owner' | 'admin'

export interface UserProfile {
  uid: string
  email: string
  displayName?: string
  photoURL?: string
  photoPath?: string
  gender?: 'male' | 'female' | 'other'
  age?: number
  height?: number // in cm
  weight?: number // in kg
  bodyShape?: string
  footSize?: string
  favoriteColors?: string[]
  dislikedColors?: string[]
  favoriteStyles?: string[]
  role: UserRole
  isSuperAdmin?: boolean
  vendorBusinessName?: string
  vendorBusinessDescription?: string
  vendorBusinessAddress?: string
  vendorContactEmail?: string
  vendorPhone?: string
  vendorWebsite?: string
  vendorApprovedAt?: Date
  vendorApprovedBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
  role?: UserRole
}
