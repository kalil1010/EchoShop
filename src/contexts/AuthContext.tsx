'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { getSupabaseClient } from '@/lib/supabaseClient'
import { AuthUser, UserProfile, UserRole } from '@/types/user'

interface AuthContextType {
  user: AuthUser | null
  userProfile: UserProfile | null
  loading: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  updateUserProfile: (profile: Partial<UserProfile>) => Promise<void>
  isSupabaseEnabled: boolean
  isVendor: boolean
  refreshProfile: () => Promise<UserProfile | null>
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
  body_shape: string | null
  foot_size: string | null
  favorite_colors: string[] | null
  disliked_colors: string[] | null
  favorite_styles: string[] | null
  role: string | null
  created_at: string | null
  updated_at: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function toDate(value: string | Date | null | undefined): Date {
  if (!value) return new Date()
  if (value instanceof Date) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

const DEFAULT_ROLE: UserRole = 'user'
const ROLE_MAP: Record<string, UserRole> = {
  user: 'user',
  vendor: 'vendor',
  admin: 'admin',
}

function normaliseRole(value: unknown): UserRole {
  if (typeof value === 'string') {
    const key = value.toLowerCase()
    if (key in ROLE_MAP) {
      return ROLE_MAP[key]
    }
  }
  return DEFAULT_ROLE
}

function sanitiseProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    displayName: profile.displayName ?? undefined,
    photoURL: profile.photoURL ?? undefined,
    photoPath: profile.photoPath ?? undefined,
    bodyShape: profile.bodyShape ?? undefined,
    footSize: profile.footSize ?? undefined,
    favoriteColors: profile.favoriteColors ?? [],
    dislikedColors: profile.dislikedColors ?? [],
    favoriteStyles: profile.favoriteStyles ?? [],
    role: normaliseRole(profile.role),
  }
}

function extractUserId(rawId: string | null | undefined): string {
  if (!rawId) return ''
  return rawId
}

function mapAuthUser(user: User): AuthUser {
  const metadata = user.user_metadata || {}
  const uid = extractUserId(user.id)
  return {
    uid,
    email: user.email ?? null,
    displayName:
      (metadata.full_name as string | undefined) ??
      (metadata.display_name as string | undefined) ??
      null,
    photoURL: (metadata.avatar_url as string | undefined) ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
    role: normaliseRole(metadata.role),
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
    bodyShape: row.body_shape ?? undefined,
    footSize: row.foot_size ?? undefined,
    favoriteColors: row.favorite_colors ?? [],
    dislikedColors: row.disliked_colors ?? [],
    favoriteStyles: row.favorite_styles ?? [],
    role: normaliseRole(row.role ?? fallback.role),
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
    gender: undefined,
    age: undefined,
    height: undefined,
    weight: undefined,
    bodyShape: undefined,
    footSize: undefined,
    favoriteColors: [],
    dislikedColors: [],
    favoriteStyles: [],
    role: normaliseRole(user.role),
    createdAt: now,
    updatedAt: now,
  })
}

export function useAuth(): AuthContextType {
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
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const applyProfileToState = useCallback(
    (profile: UserProfile, sourceUser: AuthUser) => {
      setUserProfile(profile)
      setUser((previous) => {
        if (previous && previous.uid === sourceUser.uid) {
          if (previous.role === profile.role) {
            return previous
          }
          return { ...previous, role: profile.role }
        }
        return { ...sourceUser, role: profile.role }
      })
      return profile
    },
    [],
  )

  const loadUserProfile = useCallback(
    async (authUser: AuthUser): Promise<UserProfile> => {
      if (!supabase) {
        const fallback = buildBootstrapProfile(authUser)
        return applyProfileToState(fallback, authUser)
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.uid)
          .maybeSingle<ProfileRow>()

        if (error && error.code !== 'PGRST116') {
          throw error
        }

        if (data) {
          const mapped = mapProfileRow(data, authUser)
          return applyProfileToState(mapped, authUser)
        }

        const bootstrap = buildBootstrapProfile(authUser)
        const row: Partial<ProfileRow> = {
          id: authUser.uid,
          email: authUser.email,
          display_name: bootstrap.displayName ?? null,
          photo_url: bootstrap.photoURL ?? null,
          photo_path: bootstrap.photoPath ?? null,
          gender: bootstrap.gender ?? null,
          age: bootstrap.age ?? null,
          height: bootstrap.height ?? null,
          weight: bootstrap.weight ?? null,
          body_shape: bootstrap.bodyShape ?? null,
          foot_size: bootstrap.footSize ?? null,
          favorite_colors: bootstrap.favoriteColors ?? [],
          disliked_colors: bootstrap.dislikedColors ?? [],
          favorite_styles: bootstrap.favoriteStyles ?? [],
          role: bootstrap.role,
          created_at: bootstrap.createdAt.toISOString(),
          updated_at: bootstrap.updatedAt.toISOString(),
        }

        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert(row, { onConflict: 'id' })

        if (upsertError) {
          console.warn('Failed to seed profile during auth bootstrap:', upsertError)
        }

        return applyProfileToState(bootstrap, authUser)
      } catch (error) {
        console.warn('Failed to load user profile:', error)
        const fallback = buildBootstrapProfile(authUser)
        return applyProfileToState(fallback, authUser)
      }
    },
    [supabase, applyProfileToState],
  )

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!supabase) return null
    const currentUser = user
    if (!currentUser) return null
    return loadUserProfile(currentUser)
  }, [supabase, user, loadUserProfile])

  useEffect(() => {
    if (!supabase) {
      setUser(null)
      setUserProfile(null)
      setSession(null)
      setLoading(false)
      return
    }

    let isMounted = true

    const primeSession = async () => {
      setLoading(true)
      try {
        const { data } = await supabase.auth.getSession()
        if (!isMounted) return

        const nextSession = data?.session ?? null
        setSession(nextSession)

        const sessionUser = nextSession?.user ?? null
        if (sessionUser) {
          const mapped = mapAuthUser(sessionUser)
          setUser(mapped)
          await loadUserProfile(mapped)
        } else {
          setUser(null)
          setUserProfile(null)
        }
      } catch (error) {
        console.warn('Failed to bootstrap Supabase session:', error)
        if (isMounted) {
          setUser(null)
          setUserProfile(null)
          setSession(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    primeSession()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return
      setLoading(true)
      try {
        setSession(newSession ?? null)
        const sessionUser = newSession?.user ?? null
        if (sessionUser) {
          const mapped = mapAuthUser(sessionUser)
          setUser(mapped)
          await loadUserProfile(mapped)
        } else {
          setUser(null)
          setUserProfile(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [supabase, loadUserProfile])

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) throw new Error('Supabase is not properly configured')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const message = error.message?.toLowerCase() ?? ''
        if (message.includes('email logins are disabled')) {
          throw new Error(
            'Email/password sign-ins are disabled for this account. Please use the Google option instead.',
          )
        }
        throw error
      }
    },
    [supabase],
  )

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
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
        gender: bootstrap.gender ?? null,
        age: bootstrap.age ?? null,
        height: bootstrap.height ?? null,
        weight: bootstrap.weight ?? null,
        body_shape: bootstrap.bodyShape ?? null,
        foot_size: bootstrap.footSize ?? null,
        favorite_colors: bootstrap.favoriteColors ?? [],
        disliked_colors: bootstrap.dislikedColors ?? [],
        favorite_styles: bootstrap.favoriteStyles ?? [],
        role: DEFAULT_ROLE,
        created_at: bootstrap.createdAt.toISOString(),
        updated_at: bootstrap.updatedAt.toISOString(),
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(row, { onConflict: 'id' })

      if (profileError) {
        console.warn('Failed to seed profile during sign-up:', profileError)
      }

      applyProfileToState({ ...bootstrap, role: DEFAULT_ROLE }, authUser)
    },
    [supabase, applyProfileToState],
  )

  const logout = useCallback(async () => {
    if (!supabase) throw new Error('Supabase is not properly configured')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setSession(null)
    setUser(null)
    setUserProfile(null)
  }, [supabase])

  const updateUserProfile = useCallback(
    async (profileUpdates: Partial<UserProfile>) => {
      if (!supabase) throw new Error('Supabase is not properly configured')
      if (!user) throw new Error('No user logged in')
      if (!userProfile) throw new Error('User profile not ready')

      const merged = sanitiseProfile({
        ...userProfile,
        ...profileUpdates,
        favoriteColors: profileUpdates.favoriteColors ?? userProfile.favoriteColors,
        dislikedColors: profileUpdates.dislikedColors ?? userProfile.dislikedColors,
        favoriteStyles: profileUpdates.favoriteStyles ?? userProfile.favoriteStyles,
        createdAt: userProfile.createdAt,
        updatedAt: new Date(),
        role: userProfile.role,
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
        body_shape: merged.bodyShape ?? null,
        foot_size: merged.footSize ?? null,
        favorite_colors: merged.favoriteColors ?? [],
        disliked_colors: merged.dislikedColors ?? [],
        favorite_styles: merged.favoriteStyles ?? [],
        role: merged.role,
        updated_at: merged.updatedAt.toISOString(),
      }

      const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
      if (error) throw error

      applyProfileToState(merged, user)
    },
    [supabase, user, userProfile, applyProfileToState],
  )

  const isVendor = Boolean(
    userProfile && (userProfile.role === 'vendor' || userProfile.role === 'admin'),
  )

  const isSupabaseEnabled = Boolean(supabase)

  const contextValue: AuthContextType = {
    user,
    userProfile,
    loading,
    session,
    signIn,
    signUp,
    logout,
    updateUserProfile,
    isSupabaseEnabled,
    isVendor,
    refreshProfile,
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
