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

type SignInResult = {
  user: AuthUser
  profile: UserProfile
  session: Session | null
  profileStatus: ProfileLoadState
  profileIssueMessage: string | null
  profileError: Error | null
  isProfileFallback: boolean
}

type ProfileLoadState = 'idle' | 'loading' | 'ready' | 'degraded' | 'error'

interface ProfileLoadResult {
  profile: UserProfile
  status: ProfileLoadState
  fallback: boolean
  error: Error | null
  message: string | null
}

interface AuthContextType {
  user: AuthUser | null
  userProfile: UserProfile | null
  profile: UserProfile | null
  loading: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<SignInResult>
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  updateUserProfile: (profile: Partial<UserProfile>) => Promise<void>
  isSupabaseEnabled: boolean
  isVendor: boolean
  profileStatus: ProfileLoadState
  profileError: Error | null
  profileIssueMessage: string | null
  isProfileFallback: boolean
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
  owner: 'owner',
  admin: 'owner',
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
  const toArray = (input: string[] | null | undefined): string[] =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : []

  return {
    ...profile,
    displayName: profile.displayName ?? undefined,
    photoURL: profile.photoURL ?? undefined,
    photoPath: profile.photoPath ?? undefined,
    bodyShape: profile.bodyShape ?? undefined,
    footSize: profile.footSize ?? undefined,
    favoriteColors: toArray(profile.favoriteColors),
    dislikedColors: toArray(profile.dislikedColors),
    favoriteStyles: toArray(profile.favoriteStyles),
    isSuperAdmin: Boolean(profile.isSuperAdmin),
    vendorBusinessName: profile.vendorBusinessName?.trim() || undefined,
    vendorBusinessDescription: profile.vendorBusinessDescription?.trim() || undefined,
    vendorBusinessAddress: profile.vendorBusinessAddress?.trim() || undefined,
    vendorContactEmail: profile.vendorContactEmail?.trim() || undefined,
    vendorPhone: profile.vendorPhone?.trim() || undefined,
    vendorWebsite: profile.vendorWebsite?.trim() || undefined,
    role: normaliseRole(profile.role),
  }
}

function extractUserId(rawId: string | null | undefined): string {
  if (!rawId) return ''
  return rawId
}

type ErrorWithCode = Error & { code?: string }

function copyErrorMetadata(source: unknown, target: Error) {
  if (
    source &&
    typeof source === 'object' &&
    'code' in source &&
    typeof (source as { code?: unknown }).code === 'string'
  ) {
    ;(target as ErrorWithCode).code = (source as { code: string }).code
  }
}

function normaliseError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) {
    copyErrorMetadata(value, value)
    return value
  }
  if (
    value &&
    typeof value === 'object' &&
    'message' in value &&
    typeof (value as { message?: unknown }).message === 'string'
  ) {
    const error = new Error((value as { message: string }).message)
    copyErrorMetadata(value, error)
    return error
  }
  return new Error(fallbackMessage)
}

function getErrorCode(error: unknown): string | null {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code
  }
  return null
}

function getErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }
  return error instanceof Error ? error.message : ''
}

function isPermissionError(error: unknown): boolean {
  const code = getErrorCode(error)
  const message = getErrorMessage(error).toLowerCase()
  if (code && ['42501', 'PGRST116', 'PGRST301', 'PGRST302'].includes(code.toUpperCase())) {
    return true
  }
  return message.includes('permission') || message.includes('rls')
}

function isTimeoutError(error: unknown): boolean {
  const code = getErrorCode(error)
  if (code && ['57014'].includes(code.toUpperCase())) {
    return true
  }
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('profile_timeout')
  )
}

const DEFAULT_PROFILE_TIMEOUT_MS = 45000

const PERMISSION_ISSUE_MESSAGE =
  'Profile loading failed due to database permission issues. Please contact support or retry later.'
const TIMEOUT_ISSUE_MESSAGE =
  'Loading your profile is taking longer than expected. This may be due to a database timeout. Please retry shortly or contact support.'

function resolveProfileTimeout(): number {
  const raw = process.env.NEXT_PUBLIC_PROFILE_TIMEOUT
  if (typeof raw === 'string') {
    const parsed = Number(raw)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return DEFAULT_PROFILE_TIMEOUT_MS
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 2000,
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries > 0) {
      console.log(`[Auth] Retry attempt remaining: ${retries}`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return withRetry(fn, retries - 1, delay)
    }
    throw error
  }
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
    role: normaliseRole(user.role),
    createdAt: now,
    updatedAt: now,
  })
}

function profileToRow(profile: UserProfile): Partial<ProfileRow> {
  return {
    id: profile.uid,
    email: profile.email,
    display_name: profile.displayName ?? null,
    photo_url: profile.photoURL ?? null,
    photo_path: profile.photoPath ?? null,
    gender: profile.gender ?? null,
    age: profile.age ?? null,
    height: profile.height ?? null,
    weight: profile.weight ?? null,
    body_shape: profile.bodyShape ?? null,
    foot_size: profile.footSize ?? null,
    favorite_colors: profile.favoriteColors ?? [],
    disliked_colors: profile.dislikedColors ?? [],
    favorite_styles: profile.favoriteStyles ?? [],
    is_super_admin: profile.isSuperAdmin ?? null,
    vendor_business_name: profile.vendorBusinessName ?? null,
    vendor_business_description: profile.vendorBusinessDescription ?? null,
    vendor_business_address: profile.vendorBusinessAddress ?? null,
    vendor_contact_email: profile.vendorContactEmail ?? null,
    vendor_phone: profile.vendorPhone ?? null,
    vendor_website: profile.vendorWebsite ?? null,
    role: profile.role,
    created_at: profile.createdAt.toISOString(),
    updated_at: profile.updatedAt.toISOString(),
  }
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
  const [profileStatus, setProfileStatus] = useState<ProfileLoadState>('idle')
  const [profileError, setProfileError] = useState<Error | null>(null)
  const [profileIssueMessage, setProfileIssueMessage] = useState<string | null>(null)
  const [isProfileFallback, setIsProfileFallback] = useState(false)

  const resetProfileState = useCallback(() => {
    setProfileStatus('idle')
    setProfileError(null)
    setProfileIssueMessage(null)
    setIsProfileFallback(false)
  }, [])

  const upsertProfileWithRetry = useCallback(
    async (row: Partial<ProfileRow>, authUser: AuthUser, reason: string): Promise<void> => {
      if (!supabase) return
      let attempt = 0
      const performUpsert = async () => {
        attempt += 1
        const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
        if (error) {
          console.error(
            `[AuthContext] Profile upsert attempt ${attempt} failed for ${authUser.uid} (${reason}).`,
            error,
          )
          throw error
        }
        return attempt
      }
      try {
        await withRetry(performUpsert, 2, 1500)
        console.debug(
          `[AuthContext] Profile upsert succeeded for ${authUser.uid} after ${attempt} attempt(s) (${reason}).`,
        )
      } catch (error) {
        const code = getErrorCode(error)
        const message = getErrorMessage(error)
        if (code && code.toUpperCase() === 'PGRST204') {
          const devError = new Error(
            'Profile upsert failed: mismatch between frontend payload and DB schema. Please sync columns and types.',
          )
          if (error instanceof Error) {
            ;(devError as Error & { cause?: unknown }).cause = error
            copyErrorMetadata(error, devError)
          }
          throw devError
        }
        if (message.toLowerCase().includes('column') && message.toLowerCase().includes('not found')) {
          const schemaError = new Error(
            'Profile upsert failed: mismatch between frontend payload and DB schema. Please sync columns and types.',
          )
          if (error instanceof Error) {
            ;(schemaError as Error & { cause?: unknown }).cause = error
            copyErrorMetadata(error, schemaError)
          }
          throw schemaError
        }
        throw error instanceof Error ? error : new Error('Profile upsert failed.')
      }
    },
    [supabase],
  )

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
    async (authUser: AuthUser): Promise<ProfileLoadResult> => {
      if (!supabase) {
        const fallback = buildBootstrapProfile(authUser)
        const unavailableError = normaliseError(
          new Error('SUPABASE_UNAVAILABLE'),
          'Supabase unavailable',
        )
        console.warn('[AuthContext] Supabase client unavailable. Using fallback profile.')
        const message =
          'We could not connect to the profile service. Showing a limited profile until connectivity is restored.'
        setProfileStatus('degraded')
        setProfileError(unavailableError)
        setProfileIssueMessage(message)
        setIsProfileFallback(true)
        const profile = applyProfileToState(fallback, authUser)
        return {
          profile,
          status: 'degraded',
          fallback: true,
          error: unavailableError,
          message,
        }
      }

      try {
        const { data } = await withRetry(async () => {
          const response = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.uid)
            .maybeSingle<ProfileRow>()

          if (response.error && response.error.code !== 'PGRST116') {
            console.error(
              `[AuthContext] Profile fetch error for ${authUser.uid}:`,
              response.error,
            )
            throw response.error
          }

          if (!response.data) {
            console.debug(
              `[AuthContext] Profile fetch returned no data for ${authUser.uid}.`,
            )
          }

          return response
        })

        if (data) {
          const mapped = mapProfileRow(data, authUser)
          console.debug('[AuthContext] Profile loaded successfully for', authUser.uid)
          setProfileStatus('ready')
          setProfileError(null)
          setProfileIssueMessage(null)
          setIsProfileFallback(false)
          const profile = applyProfileToState(mapped, authUser)
          return {
            profile,
            status: 'ready',
            fallback: false,
            error: null,
            message: null,
          }
        }

        console.warn(
          `[AuthContext] No profile found for ${authUser.uid}. Seeding bootstrap profile.`,
        )
        const bootstrap = buildBootstrapProfile(authUser)
        let upsertFailed = false
        let upsertError: Error | null = null
        try {
          await upsertProfileWithRetry(profileToRow(bootstrap), authUser, 'missing-profile')
        } catch (upsertError) {
          const normalisedUpsertError = normaliseError(upsertError, 'Profile upsert failed')
          setProfileError(normalisedUpsertError)
          console.error(
            `[AuthContext] Unable to seed bootstrap profile for ${authUser.uid} after missing profile.`,
            upsertError,
          )
          upsertFailed = true
          upsertError = normalisedUpsertError
        }

        console.debug('[AuthContext] Bootstrap profile applied for', authUser.uid)
        const permissionIssue = upsertFailed && upsertError ? isPermissionError(upsertError) : false
        const degradedMessage =
          'We could not find your saved profile yet. A temporary profile is in place, so some personalised features may be limited.'
        const message = permissionIssue ? PERMISSION_ISSUE_MESSAGE : degradedMessage
        setProfileStatus(permissionIssue ? 'error' : 'degraded')
        if (!upsertFailed) {
          setProfileError(null)
        }
        setProfileIssueMessage(message)
        setIsProfileFallback(true)
        const profile = applyProfileToState(bootstrap, authUser)
        return {
          profile,
          status: 'degraded',
          fallback: true,
          error: upsertError,
          message,
        }
      } catch (error) {
        console.error(
          `[AuthContext] Unhandled error in loadUserProfile for ${authUser.uid}:`,
          error,
        )
        const normalised = normaliseError(error, 'Profile fetch failed')
        const fallback = buildBootstrapProfile(authUser)
        let upsertFallbackError: Error | null = null
        try {
          await upsertProfileWithRetry(profileToRow(fallback), authUser, 'fetch-error')
        } catch (upsertError) {
          console.error(
            `[AuthContext] Fallback profile upsert failed after fetch error for ${authUser.uid}:`,
            upsertError,
          )
          upsertFallbackError = normaliseError(upsertError, 'Profile upsert failed after fetch error')
        }
        setProfileStatus('error')
        const permissionIssue = isPermissionError(upsertFallbackError ?? normalised)
        setProfileError(permissionIssue ? upsertFallbackError ?? normalised : normalised)
        const message = permissionIssue
          ? PERMISSION_ISSUE_MESSAGE
          : 'We hit an error loading your profile. Showing a limited version so you can keep working—please try again shortly.'
        setProfileIssueMessage(message)
        setIsProfileFallback(true)
        const profile = applyProfileToState(fallback, authUser)
        return {
          profile,
          status: 'error',
          fallback: true,
          error: upsertFallbackError ?? normalised,
          message,
        }
      }
    },
    [supabase, applyProfileToState, upsertProfileWithRetry],
  )

  const loadUserProfileWithTimeout = useCallback(
    async (authUser: AuthUser): Promise<ProfileLoadResult> => {
      const TIMEOUT_MS = resolveProfileTimeout()
      setProfileStatus('loading')
      setProfileError(null)
      setProfileIssueMessage(null)
      setIsProfileFallback(false)
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      try {
        const result = await Promise.race([
          loadUserProfile(authUser),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('PROFILE_TIMEOUT')), TIMEOUT_MS)
          }),
        ])
        return result
      } catch (error) {
        console.error('[AuthContext] Profile load failed or timed out:', error)
        const normalised = normaliseError(error, 'Profile load failed')
        setProfileStatus('error')
        const permissionIssue = isPermissionError(error)
        const timeoutIssue =
          normalised.message === 'PROFILE_TIMEOUT' || isTimeoutError(error)
        setProfileError(normalised)
        const issueMessage = permissionIssue
          ? PERMISSION_ISSUE_MESSAGE
          : timeoutIssue
            ? TIMEOUT_ISSUE_MESSAGE
            : 'We encountered an unexpected issue while loading your profile. A limited profile is available; please retry when you are ready.'
        setProfileIssueMessage(issueMessage)
        setIsProfileFallback(true)
        const fallback = buildBootstrapProfile(authUser)
        const profile = applyProfileToState(fallback, authUser)
        return {
          profile,
          status: 'error',
          fallback: true,
          error: normalised,
          message: issueMessage,
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    },
    [loadUserProfile, applyProfileToState],
  )

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!supabase) {
      return null
    }
    const currentUser = user
    if (!currentUser) {
      resetProfileState()
      return null
    }
    const outcome = await loadUserProfileWithTimeout(currentUser)
    return outcome.profile
  }, [supabase, user, loadUserProfileWithTimeout, resetProfileState])

  useEffect(() => {
    if (!supabase) {
      setUser(null)
      setUserProfile(null)
      setSession(null)
      resetProfileState()
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
              resetProfileState()
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
          resetProfileState()
        }
      } catch (error) {
        console.warn('Failed to bootstrap Supabase session:', error)
        if (isMounted) {
          setUser(null)
          setUserProfile(null)
          setSession(null)
          resetProfileState()
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
        resetProfileState()
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
          resetProfileState()
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
  }, [supabase, loadUserProfileWithTimeout, resetProfileState])

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
          resetProfileState()
        }
      } catch (error) {
        console.warn('[auth] storage sync failed', error)
        resetProfileState()
      } finally {
        setLoading(false)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [supabase, loadUserProfileWithTimeout, resetProfileState])

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      if (!supabase) {
        throw new Error('Supabase is not properly configured')
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const message = error.message?.toLowerCase() ?? ''
        if (message.includes('email logins are disabled')) {
          throw new Error(
            'Email/password sign-ins are disabled for this account. Please use the Google option instead.',
          )
        }
        if (message.includes('invalid login credentials')) {
          throw new Error('The email or password you entered is incorrect.')
        }
        throw error
      }

      const session = data.session ?? null
      const supabaseUser = data.user ?? session?.user ?? null
      if (!supabaseUser) {
        throw new Error('Unable to retrieve Supabase user after sign-in.')
      }

      const authUser = mapAuthUser(supabaseUser)
      setSession(session)
      setUser(authUser)
      const profileOutcome = await loadUserProfileWithTimeout(authUser)

      return {
        user: authUser,
        profile: profileOutcome.profile,
        session,
        profileStatus: profileOutcome.status,
        profileIssueMessage: profileOutcome.message,
        profileError: profileOutcome.error,
        isProfileFallback: profileOutcome.fallback,
      }
    },
    [supabase, loadUserProfileWithTimeout],
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
    resetProfileState()
  }, [supabase, resetProfileState])

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

  const isVendor = Boolean(userProfile && userProfile.role === 'vendor')

  const isSupabaseEnabled = Boolean(supabase)

  const contextValue: AuthContextType = {
    user,
    userProfile,
    profile: userProfile,
    loading,
    session,
    signIn,
    signUp,
    logout,
    updateUserProfile,
    isSupabaseEnabled,
    isVendor,
    profileStatus,
    profileError,
    profileIssueMessage,
    isProfileFallback,
    refreshProfile,
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}





