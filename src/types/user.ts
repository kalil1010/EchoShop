export type UserRole = 'user' | 'vendor' | 'owner' | 'admin'

/**
 * Mirrors the columns exposed by the `profiles` table.
 * Maintain 1:1 parity with Supabase schema (see AuthContext.profileToRow).
 */
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
  vendorBusinessAddress?: string
  vendorContactEmail?: string
  vendorPhone?: string
  vendorWebsite?: string
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
