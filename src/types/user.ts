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
favoriteStyles?: string[]
createdAt: Date
updatedAt: Date
}
export interface AuthUser {
uid: string
email: string | null
displayName: string | null
photoURL: string | null
emailVerified: boolean
}
