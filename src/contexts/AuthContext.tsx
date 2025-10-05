'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import { getSupabaseClient } from '@/lib/supabaseClient'
import { AuthUser, UserProfile } from '@/types/user'

interface AuthContextType {
  user: AuthUser | null
  userProfile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  updateUserProfile: (profile: Partial<UserProfile>) => Promise<void>
  isSupabaseEnabled: boolean
}

interface ProfileRow {
  id: string
  email: string | null
  display_name: string | null
  photo_url: string | null
  photo_path: string | null
  gender: string | null
  age: number | null
  height: number | null
  weight: number | null
  favorite_colors: string[] | null
  favorite_styles: string[] | null
  created_at: string | null
  updated_at: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function toDate(value: string | null | Date | undefined): Date {
  if (!value) return new Date()
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function sanitiseProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    displayName: profile.displayName ?? undefined,
    photoURL: profile.photoURL ?? undefined,
    photoPath: profile.photoPath ?? undefined,
    favoriteColors: profile.favoriteColors ?? [],
    favoriteStyles: profile.favoriteStyles ?? [],
  }
}

function mapAuthUser(user: User): AuthUser {
  const metadata = user.user_metadata || {}
  return {
    uid: user.id,
    email: user.email,
    displayName: (metadata.full_name as string | undefined) ?? (metadata.display_name as string | undefined) ?? null,
    photoURL: (metadata.avatar_url as string | undefined) ?? null,
    emailVerified: !!user.email_confirmed_at,
  }
}

function mapProfileRow(row: ProfileRow, fallback: AuthUser): UserProfile {
  return sanitiseProfile({
    uid: row.id,
    email: row.email ?? fallback.email ?? '',
    displayName: row.display_name ?? fallback.displayName ?? undefined,
    photoURL: row.photo_url ?? fallback.photoURL ?? undefined,
    photoPath: row.photo_path ?? undefined,
    gender: (row.gender as UserProfile['gender'] | null) ?? undefined,
    age: row.age ?? undefined,
    height: row.height ?? undefined,
    weight: row.weight ?? undefined,
    favoriteColors: row.favorite_colors ?? [],
    favoriteStyles: row.favorite_styles ?? [],
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  })
}

function buildBootstrapProfile(user: AuthUser): UserProfile {
  const now = new Date()
  return sanitiseProfile({
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? undefined,
    photoURL: user.photoURL ?? undefined,
    photoPath: undefined,
    favoriteColors: [],
    favoriteStyles: [],
    createdAt: now,
    updatedAt: now,
  })
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => {
    try {
      return getSupabaseClient()
    } catch (error) {
      console.error('Supabase client initialisation failed:', error)
      return null
    }
  }, [])

  const [user, setUser] = useState<AuthUser | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const isSupabaseEnabled = !!supabase

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let isMounted = true

    const loadUserProfile = async (authUser: AuthUser) => {
      try {
        const { data, error } = await supabase
          .from<ProfileRow>('profiles')
          .select('*')
          .eq('id', authUser.uid)
          .maybeSingle()

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        if (data) {
          if (!isMounted) return
          setUserProfile(mapProfileRow(data, authUser))
        } else {
          const bootstrap = buildBootstrapProfile(authUser)
          const row: Partial<ProfileRow> = {
            id: authUser.uid,
            email: authUser.email,
            display_name: bootstrap.displayName ?? null,
            photo_url: bootstrap.photoURL ?? null,
      photo_path: bootstrap.photoPath ?? null,
            photo_path: bootstrap.photoPath ?? null,
            favorite_colors: bootstrap.favoriteColors,
            favorite_styles: bootstrap.favoriteStyles,
            created_at: bootstrap.createdAt.toISOString(),
            updated_at: bootstrap.updatedAt.toISOString(),
          }
          const { error: insertError } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
          if (insertError) {
            console.warn('Failed to bootstrap profile:', insertError)
          }
          if (!isMounted) return
          setUserProfile(bootstrap)
        }
      } catch (err) {
        console.warn('Failed to load profile:', err)
        if (!isMounted) return
        setUserProfile(buildBootstrapProfile(authUser))
      }
    }

    const loadInitialSession = async () => {
      const { data } = await supabase.auth.getSession()
      const sessionUser = data.session?.user

      if (!isMounted) return

      if (sessionUser) {
        const mapped = mapAuthUser(sessionUser)
        setUser(mapped)
        await loadUserProfile(mapped)
      } else {
        setUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    }

    loadInitialSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (!isMounted) return
      const sessionUser = session?.user
      if (sessionUser) {
        const mapped = mapAuthUser(sessionUser)
        setUser(mapped)
        loadUserProfile(mapped)
      } else {
        setUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not properly configured')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!supabase) throw new Error('Supabase is not properly configured')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName ?? null,
        },
      },
    })

    if (error) throw error

    const newUser = data.user
    if (!newUser) return

    const authUser = mapAuthUser(newUser)
    const bootstrap = buildBootstrapProfile(authUser)

    const row: Partial<ProfileRow> = {
      id: authUser.uid,
      email: authUser.email,
      display_name: bootstrap.displayName ?? null,
      photo_url: bootstrap.photoURL ?? null,
      photo_path: bootstrap.photoPath ?? null,
            photo_path: bootstrap.photoPath ?? null,
      favorite_colors: bootstrap.favoriteColors,
      favorite_styles: bootstrap.favoriteStyles,
      created_at: bootstrap.createdAt.toISOString(),
      updated_at: bootstrap.updatedAt.toISOString(),
    }

    const { error: profileError } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
    if (profileError) {
      console.warn('Failed to seed profile during sign-up:', profileError)
    }

    setUserProfile(bootstrap)
  }

  const logout = async () => {
    if (!supabase) throw new Error('Supabase is not properly configured')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const updateUserProfile = async (profileUpdates: Partial<UserProfile>) => {
    if (!supabase) throw new Error('Supabase is not properly configured')
    if (!user) throw new Error('No user logged in')
    if (!userProfile) throw new Error('User profile not ready')

    const merged = sanitiseProfile({
      ...userProfile,
      ...profileUpdates,
      favoriteColors: profileUpdates.favoriteColors ?? userProfile.favoriteColors,
      favoriteStyles: profileUpdates.favoriteStyles ?? userProfile.favoriteStyles,
      createdAt: userProfile.createdAt,
      updatedAt: new Date(),
    })

    const row: Partial<ProfileRow> = {
      id: user.uid,
      email: merged.email,
      display_name: merged.displayName ?? null,
      photo_url: merged.photoURL ?? null,
      photo_path: merged.photoPath ?? null,
      gender: merged.gender ?? null,
      age: merged.age ?? null,
      height: merged.height ?? null,
      weight: merged.weight ?? null,
      favorite_colors: merged.favoriteColors,
      favorite_styles: merged.favoriteStyles,
      updated_at: merged.updatedAt.toISOString(),
    }

    const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
    if (error) throw error

    setUserProfile(merged)
  }

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    logout,
    updateUserProfile,
    isSupabaseEnabled,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


