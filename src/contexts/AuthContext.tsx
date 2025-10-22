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
  is_super_admin: boolean | null
  vendor_business_name: string | null
  vendor_business_description: string | null
  vendor_business_address: string | null
  vendor_contact_email: string | null
  vendor_phone: string | null
  vendor_website: string | null
  vendor_approved_at: string | null
  vendor_approved_by: string | null
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
    isSuperAdmin: Boolean(profile.isSuperAdmin),
    vendorBusinessName: profile.vendorBusinessName?.trim() || undefined,
    vendorBusinessDescription: profile.vendorBusinessDescription?.trim() || undefined,
    vendorBusinessAddress: profile.vendorBusinessAddress?.trim() || undefined,
    vendorContactEmail: profile.vendorContactEmail?.trim() || undefined,
    vendorPhone: profile.vendorPhone?.trim() || undefined,
    vendorWebsite: profile.vendorWebsite?.trim() || undefined,
    vendorApprovedAt: profile.vendorApprovedAt ? toDate(profile.vendorApprovedAt) : undefined,
    vendorApprovedBy: profile.vendorApprovedBy ?? undefined,
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
    isSuperAdmin: Boolean(row.is_super_admin),
    vendorBusinessName: row.vendor_business_name ?? undefined,
    vendorBusinessDescription: row.vendor_business_description ?? undefined,
    vendorBusinessAddress: row.vendor_business_address ?? undefined,
    vendorContactEmail: row.vendor_contact_email ?? undefined,
    vendorPhone: row.vendor_phone ?? undefined,
    vendorWebsite: row.vendor_website ?? undefined,
    vendorApprovedAt: row.vendor_approved_at ? toDate(row.vendor_approved_at) : undefined,
    vendorApprovedBy: row.vendor_approved_by ?? undefined,
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
    isSuperAdmin: false,
    vendorBusinessName: undefined,
    vendorBusinessDescription: undefined,
    vendorBusinessAddress: undefined,
    vendorContactEmail: undefined,
    vendorPhone: undefined,
    vendorWebsite: undefined,
    vendorApprovedAt: undefined,
    vendorApprovedBy: undefined,
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
        console.warn('[AuthContext] Supabase client unavailable. Using fallback profile.')
        return applyProfileToState(fallback, authUser)
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.uid)
          .maybeSingle<ProfileRow>()

        if (error && error.code !== 'PGRST116') {
          console.error('[AuthContext] Profile fetch error:', error)
          throw error
        }

        if (data) {
          const mapped = mapProfileRow(data, authUser)
          console.debug('[AuthContext] Profile loaded successfully for', authUser.uid)
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
          console.error('[AuthContext] Profile upsert error:', upsertError)
        }

        console.debug('[AuthContext] Bootstrap profile applied for', authUser.uid)
        return applyProfileToState(bootstrap, authUser)
      } catch (error) {
        console.error('[AuthContext] Unhandled error in loadUserProfile:', error)
        const fallback = buildBootstrapProfile(authUser)
        return applyProfileToState(fallback, authUser)
      }
    },
    [supabase, applyProfileToState],
  )

  const loadUserProfileWithTimeout = useCallback(
    async (authUser: AuthUser): Promise<UserProfile> => {
      const TIMEOUT_MS = 10000
      try {
        const result = await Promise.race([
          loadUserProfile(authUser),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Profile load timeout')), TIMEOUT_MS),
          ),
        ])
        return result
      } catch (error) {
        console.error('[AuthContext] Profile load failed or timed out:', error)
        const fallback = buildBootstrapProfile(authUser)
        return applyProfileToState(fallback, authUser)
      }
    },
    [loadUserProfile, applyProfileToState],
  )

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!supabase) return null
    const currentUser = user
    if (!currentUser) return null
    return loadUserProfileWithTimeout(currentUser)
  }, [supabase, user, loadUserProfileWithTimeout])

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
      console.log('[AuthContext] Starting session initialization')
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.warn('[AuthContext] Session error:', error)
          const message = typeof error.message === 'string' ? error.message : ''
          if (message.includes('Refresh Token') || message.includes('Invalid')) {
            console.log('[AuthContext] Invalid token detected, clearing session')
            await supabase.auth.signOut({ scope: 'local' })
            if (isMounted) {
              setUser(null)
              setUserProfile(null)
              setSession(null)
            }
            return
          }
          throw error
        }
        if (!isMounted) return

        const nextSession = data?.session ?? null
        setSession(nextSession)

        const sessionUser = nextSession?.user ?? null
        if (sessionUser) {
          const mapped = mapAuthUser(sessionUser)
          setUser(mapped)
          await loadUserProfileWithTimeout(mapped)
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
          console.log('[AuthContext] Session initialization complete')
        }
      }
    }

    primeSession()

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return
      console.log('[AuthContext] Auth state changed:', event)
      if (event === 'TOKEN_REFRESHED' && !newSession) {
        console.warn('[AuthContext] Token refresh failed, clearing session')
        setSession(null)
        setUser(null)
        setUserProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        setSession(newSession ?? null)
        const sessionUser = newSession?.user ?? null
        if (sessionUser) {
          const mapped = mapAuthUser(sessionUser)
          setUser(mapped)
          await loadUserProfileWithTimeout(mapped)
        } else {
          setUser(null)
          setUserProfile(null)
        }
      } catch (error) {
        console.error('[AuthContext] Auth state change failed:', error)
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
  }, [supabase, loadUserProfileWithTimeout])

  useEffect(() => {
    if (!supabase || typeof window === 'undefined') return

    const handleStorage = async (event: StorageEvent) => {
      if (!event.key || !event.key.includes('-auth-token')) return

      setLoading(true)
      try {
        const { data, error } = await supabase.auth.getSession()
        const nextSession = data?.session ?? null
        setSession(nextSession)

        const sessionUser = nextSession?.user ?? null
        if (sessionUser) {
          const mapped = mapAuthUser(sessionUser)
          setUser(mapped)
          await loadUserProfileWithTimeout(mapped)
        } else {
          setUser(null)
          setUserProfile(null)
        }
      } catch (error) {
        console.warn('[auth] storage sync failed', error)
      } finally {
        setLoading(false)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [supabase, loadUserProfileWithTimeout])

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
    try {
      const { data, error } = await supabase.auth.getSession()
      if (data.session) {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      }
    } catch (error) {
      const tokenError =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: string }).message === 'string' &&
        (error as { message: string }).message.includes('Refresh Token Not Found')
      if (!tokenError) {
        throw error
      }
    }
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





