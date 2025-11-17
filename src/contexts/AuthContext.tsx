'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { getSupabaseClient } from '@/lib/supabaseClient'
import { DEFAULT_ROLE, getRoleMeta, normaliseRole } from '@/lib/roles'
import { disableOptionalProfileColumn, extractMissingProfileColumn, filterProfilePayload } from '@/lib/profileSchema'
import type { RoleMeta } from '@/lib/roles'
import { AuthUser, UserProfile, UserRole } from '@/types/user'
import { realtimeSubscriptionManager } from '@/lib/realtimeSubscriptionManager'

type SignInResult = {
  user: AuthUser
  profile: UserProfile
  session: Session | null
  profileStatus: ProfileLoadState
  profileIssueMessage: string | null
  profileError: Error | null
  isProfileFallback: boolean
  requires2FA?: boolean
  twoFASessionToken?: string
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
  role: UserRole
  roleMeta: RoleMeta
  loading: boolean
  session: Session | null
  signIn: (email: string, password: string, captchaToken?: string) => Promise<SignInResult>
  signUp: (email: string, password: string, displayName?: string, captchaToken?: string) => Promise<void>
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
  vendor_business_name?: string | null
  vendor_business_address?: string | null
  vendor_business_description?: string | null
  vendor_contact_email?: string | null
  vendor_phone?: string | null
  vendor_website?: string | null
  vendor_logo_url?: string | null
  vendor_banner_url?: string | null
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
    vendorBusinessAddress: profile.vendorBusinessAddress?.trim() || undefined,
    vendorBusinessDescription: profile.vendorBusinessDescription?.trim() || undefined,
    vendorContactEmail: profile.vendorContactEmail?.trim() || undefined,
    vendorPhone: profile.vendorPhone?.trim() || undefined,
    vendorWebsite: profile.vendorWebsite?.trim() || undefined,
    vendorLogoUrl: profile.vendorLogoUrl || undefined,
    vendorBannerUrl: profile.vendorBannerUrl || undefined,
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

const DEFAULT_PROFILE_TIMEOUT_MS = 10000 // Reduced from 45s to 10s for better UX

const PERMISSION_ISSUE_MESSAGE =
  'Profile loading failed due to database permission issues. Please contact support or retry later.'
const TIMEOUT_ISSUE_MESSAGE =
  'Loading your profile is taking longer than expected. This may be due to a database timeout. Please retry shortly or contact support.'
const PROFILE_SYNC_SUPPORT_MESSAGE =
  'We could not sync your profile after sign-in. Retry profile sync or contact support if this continues.'

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

// Task C1: Improved server session sync with retry logic and vendor data
async function syncServerSession(
  event: string,
  session: Session | null,
  userProfile?: UserProfile | null,
): Promise<void> {
  if (!session?.user) {
    // For sign out, just send the event
    try {
      await fetch('/api/auth/callback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, session: null }),
      })
    } catch (error) {
      console.warn('[AuthContext] Failed to sync logout to server:', error)
    }
    return
  }

  // Retry logic with exponential backoff
  let attempt = 0
  const maxAttempts = 3
  const TIMEOUT_MS = 5000 // 5 second timeout

  async function attemptSync(): Promise<boolean> {
    attempt += 1
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const payload = {
        event,
        session,
        userProfile: userProfile
          ? {
              uid: userProfile.uid,
              role: userProfile.role,
              vendorStatus: userProfile.role === 'vendor' ? 'approved' : null,
            }
          : null,
      }

      const response = await fetch('/api/auth/callback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        console.debug('[AuthContext] Server session synced successfully')
        return true
      }

      // Server error (5xx), retry
      if (response.status >= 500 && attempt < maxAttempts) {
        const delay = 1000 * attempt // Exponential backoff: 1s, 2s, 3s
        await new Promise((resolve) => setTimeout(resolve, delay))
        return attemptSync()
      }

      // Client error or max retries reached
      console.warn('[AuthContext] Server sync failed:', response.status)
      return false
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[AuthContext] Server sync timed out after 5s')
        return false
      }

      // Network error, retry if attempts remain
      if (attempt < maxAttempts) {
        const delay = 1000 * attempt
        await new Promise((resolve) => setTimeout(resolve, delay))
        return attemptSync()
      }

      console.error('[AuthContext] Server sync error after retries:', error)
      return false
    }
  }

  // Fire and forget - don't block on this
  attemptSync().catch(() => {
    // Silently fail - session sync is best effort
  })
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
    vendorBusinessAddress: row.vendor_business_address ?? undefined,
    vendorBusinessDescription: row.vendor_business_description ?? undefined,
    vendorContactEmail: row.vendor_contact_email ?? undefined,
    vendorPhone: row.vendor_phone ?? undefined,
    vendorWebsite: row.vendor_website ?? undefined,
    vendorLogoUrl: row.vendor_logo_url ?? undefined,
    vendorBannerUrl: row.vendor_banner_url ?? undefined,
    role: normaliseRole(row.role ?? fallback.role),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  })
}

/**
 * Check if user has an approved vendor request
 */
async function checkVendorStatus(
  supabase: ReturnType<typeof getSupabaseClient> | null,
  userId: string,
): Promise<'approved' | 'pending' | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('vendor_requests')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ status: string }>()

    if (error) {
      console.warn('[AuthContext] Failed to check vendor status:', error)
      return null
    }

    if (data?.status === 'approved') return 'approved'
    if (data?.status === 'pending') return 'pending'
    return null
  } catch (error) {
    console.warn('[AuthContext] Error checking vendor status:', error)
    return null
  }
}

function buildBootstrapProfile(
  user: AuthUser,
  vendorStatus?: 'approved' | 'pending' | null,
): UserProfile {
  const now = new Date()
  
  // Determine role priority:
  // 1. Auth metadata role (if set) - highest priority
  // 2. Approved vendor request - second priority
  // 3. Default role - fallback
  let role: UserRole = DEFAULT_ROLE
  
  if (user.role !== undefined) {
    // Auth metadata has explicit role - use it
    role = normaliseRole(user.role)
  } else if (vendorStatus === 'approved') {
    // No auth metadata role, but has approved vendor request
    role = 'vendor'
  }

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
    vendorBusinessAddress: undefined,
    vendorContactEmail: undefined,
    vendorPhone: undefined,
    vendorWebsite: undefined,
    vendorLogoUrl: undefined,
    vendorBannerUrl: undefined,
    role, // Set role based on vendor status
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
    vendor_business_address: profile.vendorBusinessAddress ?? null,
    vendor_business_description: profile.vendorBusinessDescription ?? null,
    vendor_contact_email: profile.vendorContactEmail ?? null,
    vendor_phone: profile.vendorPhone ?? null,
    vendor_website: profile.vendorWebsite ?? null,
    vendor_logo_url: profile.vendorLogoUrl ?? null,
    vendor_banner_url: profile.vendorBannerUrl ?? null,
    role: profile.role,
    created_at: profile.createdAt.toISOString(),
    updated_at: profile.updatedAt.toISOString(),
  }
}

function normalisePersistedProfile(profile: UserProfile): UserProfile {
  const now = new Date()
  const createdAt =
    profile.createdAt instanceof Date && !Number.isNaN(profile.createdAt.getTime())
      ? profile.createdAt
      : now
  return {
    ...profile,
    role: normaliseRole(profile.role),
    createdAt,
    updatedAt: now,
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
      const maxRetries = 10 // Increased to handle multiple missing columns
      
      const performUpsert = async (): Promise<number> => {
        attempt += 1
        const payload = filterProfilePayload(row)
        const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
        if (error) {
          const code = getErrorCode(error)
          const message = getErrorMessage(error)
          
          // Check if it's a missing column error
          const missingColumn = extractMissingProfileColumn(error)
          if (missingColumn && disableOptionalProfileColumn(missingColumn)) {
            console.warn(
              `[AuthContext] Optional profile column "${missingColumn}" missing in Supabase schema. Retrying without it (attempt ${attempt}/${maxRetries}).`,
            )
            // If we disabled a column and have retries left, retry immediately
            if (attempt < maxRetries && (code === 'PGRST204' || message.toLowerCase().includes('column'))) {
              // Don't throw, let the retry mechanism handle it
              throw error
            }
          }
          
          console.error(
            `[AuthContext] Profile upsert attempt ${attempt} failed for ${authUser.uid} (${reason}).`,
            error,
          )
          throw error
        }
        return attempt
      }
      try {
        await withRetry(performUpsert, maxRetries - 1, 1500)
        console.debug(
          `[AuthContext] Profile upsert succeeded for ${authUser.uid} after ${attempt} attempt(s) (${reason}).`,
        )
      } catch (error) {
        const code = getErrorCode(error)
        const message = getErrorMessage(error)
        
        // Handle RLS/permission errors (42501)
        if (code === '42501' || message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('violates row-level security')) {
          const rlsError = new Error(
            'Profile update blocked by database security policy. Please ensure Row Level Security policies are configured correctly for the profiles table.',
          )
          if (error instanceof Error) {
            ;(rlsError as Error & { cause?: unknown }).cause = error
            copyErrorMetadata(error, rlsError)
          }
          console.error(
            `[AuthContext] RLS policy violation during profile upsert for ${authUser.uid}. Ensure RLS policies allow users to update their own profiles.`,
            error,
          )
          throw rlsError
        }
        
        // For PGRST204 errors, try to extract and disable the missing column before giving up
        if (code && code.toUpperCase() === 'PGRST204') {
          const missingColumn = extractMissingProfileColumn(error)
          if (missingColumn && disableOptionalProfileColumn(missingColumn)) {
            console.warn(
              `[AuthContext] Detected missing column "${missingColumn}" in PGRST204 error. Disabled for future attempts.`,
            )
            // Don't throw yet - let the retry mechanism handle it if there are retries left
            // But if we're here, all retries have been exhausted, so throw the error
          }
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
          const missingColumn = extractMissingProfileColumn(error)
          if (missingColumn && disableOptionalProfileColumn(missingColumn)) {
            console.warn(
              `[AuthContext] Detected missing column "${missingColumn}" in column error. Disabled for future attempts.`,
            )
          }
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

  // Task A2: Helper functions for cookie/localStorage persistence
  const setRoleCookie = useCallback((role: UserRole, uid: string) => {
    if (typeof document === 'undefined') return
    const maxAge = 604800 // 7 days
    document.cookie = `user_role=${role}; path=/; max-age=${maxAge}; SameSite=Lax`
    document.cookie = `user_id=${uid}; path=/; max-age=${maxAge}; SameSite=Lax`
  }, [])

  const setRoleLocalStorage = useCallback((profile: UserProfile) => {
    if (typeof window === 'undefined') return
    try {
      const data = {
        uid: profile.uid,
        role: profile.role,
        vendorName: profile.vendorBusinessName,
        timestamp: Date.now(),
      }
      localStorage.setItem('echoshop_vendor_status', JSON.stringify(data))
    } catch (error) {
      console.warn('[AuthContext] Failed to save role to localStorage:', error)
    }
  }, [])

  const clearRoleStorage = useCallback(() => {
    if (typeof document === 'undefined') return
    document.cookie = 'user_role=; path=/; max-age=0'
    document.cookie = 'user_id=; path=/; max-age=0'
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('echoshop_vendor_status')
      } catch (error) {
        console.warn('[AuthContext] Failed to clear localStorage:', error)
      }
    }
  }, [])

  const getRoleFromLocalStorage = useCallback((): { role: UserRole; uid: string } | null => {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem('echoshop_vendor_status')
      if (!stored) return null
      const data = JSON.parse(stored)
      // Only use if less than 24 hours old
      if (data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
        return { role: normaliseRole(data.role), uid: data.uid }
      }
      return null
    } catch (error) {
      console.warn('[AuthContext] Failed to read role from localStorage:', error)
      return null
    }
  }, [])

  // Session cache constants
  const SESSION_CACHE_VERSION = 1 // Increment when cache structure changes
  const SESSION_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  interface SessionCacheData {
    version: number
    user: AuthUser
    profile: UserProfile
    role: UserRole
    timestamp: number
  }

  const getSessionCache = useCallback((): SessionCacheData | null => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('echoshop_session_cache')
      if (!cached) return null
      
      const data = JSON.parse(cached) as SessionCacheData
      
      // Validate version
      if (data.version !== SESSION_CACHE_VERSION) {
        sessionStorage.removeItem('echoshop_session_cache')
        return null
      }
      
      // Validate TTL
      if (!data.timestamp || Date.now() - data.timestamp > SESSION_CACHE_TTL) {
        sessionStorage.removeItem('echoshop_session_cache')
        return null
      }
      
      // Validate required fields
      if (!data.user?.uid || !data.profile || !data.role) {
        sessionStorage.removeItem('echoshop_session_cache')
        return null
      }
      
      return data
    } catch (e) {
      console.warn('[AuthContext] Failed to read session cache:', e)
      try {
        sessionStorage.removeItem('echoshop_session_cache')
      } catch {
        // Ignore cleanup errors
      }
      return null
    }
  }, [])

  const setSessionCache = useCallback((
    user: AuthUser, 
    profile: UserProfile, 
    session: Session | null
  ) => {
    if (typeof window === 'undefined' || !session) return
    try {
      const cacheData: SessionCacheData = {
        version: SESSION_CACHE_VERSION,
        user,
        profile,
        role: profile.role,
        timestamp: Date.now(),
      }
      sessionStorage.setItem('echoshop_session_cache', JSON.stringify(cacheData))
    } catch (e) {
      // Storage quota exceeded or other error - silently fail
      console.debug('[AuthContext] Failed to write session cache (may be expected):', e)
    }
  }, [])

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
      // Task A2: Persist role to cookie and localStorage
      setRoleCookie(profile.role, profile.uid)
      setRoleLocalStorage(profile)
      return profile
    },
    [setRoleCookie, setRoleLocalStorage],
  )

  /**
   * Determine if authRole should override profileRole based on role hierarchy
   * Role hierarchy: user < vendor < owner/admin
   * Only upgrades are allowed (never downgrade for security)
   */
  const shouldUpgradeRole = useCallback((profileRole: UserRole, authRole: UserRole): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      user: 1,
      vendor: 2,
      owner: 3,
      admin: 3, // admin is same level as owner
    }
    const profileLevel = roleHierarchy[profileRole] ?? 0
    const authLevel = roleHierarchy[authRole] ?? 0
    return authLevel > profileLevel
  }, [])

  const reconcileProfileAfterAuth = useCallback(
    async (authUser: AuthUser, profile: UserProfile): Promise<UserProfile> => {
      const normalised = normalisePersistedProfile(profile)
      let roleChanged = false

      // Task A1: Check if user has an approved vendor request and upgrade role if needed
      if (normalised.role === 'user' && supabase) {
        const vendorStatus = await checkVendorStatus(supabase, authUser.uid)
        if (vendorStatus === 'approved') {
          console.debug(
            '[AuthContext] Upgraded user to vendor role based on approved request',
            { userId: authUser.uid },
          )
          normalised.role = 'vendor'
          roleChanged = true
        }
      }

      // Sync role from auth metadata to profile if auth role is higher
      // This handles cases where role is set in auth metadata (e.g., via admin update)
      // but profile hasn't been updated yet
      // Only sync if authUser.role is explicitly set (not undefined)
      if (authUser.role !== undefined) {
        const authRole = normaliseRole(authUser.role)
        if (authRole !== normalised.role && shouldUpgradeRole(normalised.role, authRole)) {
          console.debug(
            '[AuthContext] Syncing role from auth metadata to profile',
            {
              userId: authUser.uid,
              profileRole: normalised.role,
              authRole,
            },
          )
          normalised.role = authRole
          roleChanged = true
        }
      }

      // Only upsert if role changed to avoid unnecessary database writes
      if (roleChanged) {
        await upsertProfileWithRetry(profileToRow(normalised), authUser, 'post-sign-in')
        console.debug(
          '[AuthContext] Post-sign-in profile sync completed with role update',
          { userId: authUser.uid, role: normalised.role },
        )
      } else {
        console.debug(
          '[AuthContext] Post-sign-in profile sync completed (no changes)',
          { userId: authUser.uid, role: normalised.role },
        )
      }
      return applyProfileToState(normalised, authUser)
    },
    [upsertProfileWithRetry, applyProfileToState, supabase, shouldUpgradeRole],
  )

  const loadUserProfile = useCallback(
    async (authUser: AuthUser): Promise<ProfileLoadResult> => {
      if (!supabase) {
        const fallback = buildBootstrapProfile(authUser, null)
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
        // Task A3: Check vendor status before building bootstrap profile
        const vendorStatus = await checkVendorStatus(supabase, authUser.uid)
        const bootstrap = buildBootstrapProfile(authUser, vendorStatus)
        let upsertFailed = false
        let upsertError: Error | null = null
        try {
          await upsertProfileWithRetry(profileToRow(bootstrap), authUser, 'missing-profile')
        } catch (caughtError) {
          const normalisedUpsertError = normaliseError(caughtError, 'Profile upsert failed')
          setProfileError(normalisedUpsertError)
          console.error(
            `[AuthContext] Unable to seed bootstrap profile for ${authUser.uid} after missing profile.`,
            caughtError,
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
        const fallback = buildBootstrapProfile(authUser, null)
        let upsertFallbackError: Error | null = null
        try {
          await upsertProfileWithRetry(profileToRow(fallback), authUser, 'fetch-error')
        } catch (caughtError) {
          console.error(
            `[AuthContext] Fallback profile upsert failed after fetch error for ${authUser.uid}:`,
            caughtError,
          )
          upsertFallbackError = normaliseError(caughtError, 'Profile upsert failed after fetch error')
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
    [supabase, applyProfileToState, upsertProfileWithRetry, getRoleFromLocalStorage],
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
        const normalised = normaliseError(error, 'Profile load failed')
        const permissionIssue = isPermissionError(error)
        const timeoutIssue =
          normalised.message === 'PROFILE_TIMEOUT' || isTimeoutError(error)
        
        // Only log as error if it's not a timeout (timeouts are handled gracefully)
        if (!timeoutIssue) {
          console.error('[AuthContext] Profile load failed:', error)
        } else {
          // Log timeout as debug/warn, not error, since we handle it gracefully
          console.debug('[AuthContext] Profile load timed out, using fallback profile')
        }
        
        setProfileStatus('error')
        setProfileError(normalised)
        const issueMessage = permissionIssue
          ? PERMISSION_ISSUE_MESSAGE
          : timeoutIssue
            ? TIMEOUT_ISSUE_MESSAGE
            : 'We encountered an unexpected issue while loading your profile. A limited profile is available; please retry when you are ready.'
        setProfileIssueMessage(issueMessage)
        setIsProfileFallback(true)
        
        // CRITICAL FIX: Preserve existing role instead of defaulting to 'user'
        // Check localStorage for last known good role, or use current userProfile role
        let preservedRole: UserRole | undefined = undefined
        const lastKnownRole = getRoleFromLocalStorage()
        if (lastKnownRole && lastKnownRole.uid === authUser.uid && lastKnownRole.role !== 'user') {
          preservedRole = lastKnownRole.role
        } else if (userProfile && userProfile.uid === authUser.uid && userProfile.role !== 'user') {
          // Preserve current profile role if it exists and is better than default
          preservedRole = userProfile.role
        }
        
        const fallback = buildBootstrapProfile(authUser, null)
        // Override role if we have a preserved role
        if (preservedRole) {
          fallback.role = preservedRole
          console.debug('[AuthContext] Preserving role on timeout:', preservedRole)
        }
        const profile = applyProfileToState(fallback, authUser)
        if (timeoutIssue) {
          // Silently retry in background without logging errors
          loadUserProfile(authUser).catch(() => {
            // Silently fail - we already have a fallback profile
          })
        }
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
    [loadUserProfile, applyProfileToState, getRoleFromLocalStorage, userProfile],
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
    
    // Also trigger role sync when refreshing profile (not just on login)
    // This ensures roles stay in sync even for existing sessions
    if (outcome.profile) {
      try {
        const syncedProfile = await reconcileProfileAfterAuth(currentUser, outcome.profile)
        return syncedProfile
      } catch (syncError) {
        // If sync fails, return the original profile
        console.warn('[AuthContext] Role sync failed during profile refresh:', syncError)
        return outcome.profile
      }
    }
    
    return outcome.profile
  }, [supabase, user, loadUserProfileWithTimeout, resetProfileState, reconcileProfileAfterAuth])

  // Use ref to track if initialization has been started to prevent multiple runs
  const initializationStartedRef = useRef(false)

  useEffect(() => {
    if (!supabase) {
      setUser(null)
      setUserProfile(null)
      setSession(null)
      resetProfileState()
      setLoading(false)
      initializationStartedRef.current = false
      return
    }

    // CRITICAL: Prevent effect from running multiple times
    if (initializationStartedRef.current) {
      console.debug('[AuthContext] Initialization already started, skipping effect re-run')
      return
    }

    let isMounted = true
    let isInitializing = false // Guard to prevent multiple simultaneous initializations

    const primeSession = async () => {
      // CRITICAL: Prevent multiple simultaneous initializations
      if (isInitializing) {
        console.debug('[AuthContext] Session initialization already in progress, skipping...')
        return
      }
      
      isInitializing = true
      initializationStartedRef.current = true
      console.log('[AuthContext] Starting session initialization')
      setLoading(true)
      
      // CRITICAL FIX: Check cache FIRST before Supabase calls
      // Use cache as fallback when Supabase fails, not verification of success
      let cachedData: SessionCacheData | null = null
      let isCacheRestoration = false
      if (typeof window !== 'undefined') {
        cachedData = getSessionCache()
        if (cachedData) {
          isCacheRestoration = true
          console.debug('[AuthContext] Found session cache, will use as fallback if Supabase fails')
          // Hydrate from cache immediately for instant UI
          setUser(cachedData.user)
          setUserProfile(cachedData.profile)
          // Don't set loading to false yet - verify with Supabase in background
        }
      }
      try {
        // Task A2: Try to load role from localStorage for faster hydration
        const cachedRole = getRoleFromLocalStorage()
        if (cachedRole) {
          console.debug('[AuthContext] Found cached role in localStorage:', cachedRole.role)
        }

        // First, try to get session from storage (this reads from localStorage)
        // Add a small delay to ensure localStorage is accessible after page navigation
        await new Promise((resolve) => setTimeout(resolve, 100))
        
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          const message = typeof sessionError.message === 'string' ? sessionError.message : ''
          const code = typeof (sessionError as { code?: string }).code === 'string' 
            ? (sessionError as { code: string }).code 
            : ''
          
          // Handle refresh token errors gracefully - these are expected when tokens expire
          if (
            message.includes('Refresh Token') || 
            message.includes('Invalid') ||
            code === 'refresh_token_not_found' ||
            message.includes('refresh_token_not_found')
          ) {
            // CRITICAL FIX: If cache exists, use it as fallback instead of clearing
            if (cachedData) {
              console.debug('[AuthContext] Supabase session failed, but cache exists - using cache as fallback')
              // Cache already hydrated user and profile above
              // Try to get session in background, but don't block
              supabase.auth.getSession()
                .then(({ data }) => {
                  if (data?.session && isMounted) {
                    setSession(data.session)
                  }
                })
                .catch(() => {
                  // Session retrieval failed - use cache without session
                  console.debug('[AuthContext] Using cache without session - will restore on next interaction')
                })
              setLoading(false)
              isInitializing = false
              return
            }
            
            // No cache - clear everything
            console.debug('[AuthContext] Refresh token invalid or expired, no cache - clearing session and cookies')
            // Clear local session first
            try {
              await supabase.auth.signOut({ scope: 'local' })
            } catch (signOutError) {
              // Ignore signOut errors if token is already invalid
            }
            // Clear server-side cookies - this is critical to prevent middleware loops
            try {
              await syncServerSession('SIGNED_OUT', null)
            } catch (syncError) {
              // Log but don't block - cookies might already be cleared
              console.warn('[AuthContext] Failed to sync sign-out to server (may be expected):', syncError)
            }
            if (isMounted) {
              setUser(null)
              setUserProfile(null)
              setSession(null)
              resetProfileState()
            }
            return
          }
          
          // For other errors, if cache exists, use it as fallback
          if (cachedData) {
            console.debug('[AuthContext] Supabase session error, but cache exists - using cache as fallback')
            // Cache already hydrated state above
            setLoading(false)
            isInitializing = false
            return
          }
          
          // No cache and error - log and throw
          console.warn('[AuthContext] Session error and no cache:', sessionError)
          throw sessionError
        }
        if (!isMounted) return

        const nextSession = data?.session ?? null
        setSession(nextSession)
        if (nextSession) {
          // Sync session to server asynchronously (don't block initialization)
          // This is critical for OAuth flows and page refreshes
          // Note: Profile not loaded yet, so pass null for userProfile
          // We don't await this to prevent blocking the initialization flow
          syncServerSession('SIGNED_IN', nextSession, null)
            .then(() => {
              console.debug('[AuthContext] Initial session synced to server')
            })
            .catch((error) => {
              console.warn('[AuthContext] Failed to sync initial session to server:', error)
            })
        } else {
          void syncServerSession('SIGNED_OUT', null)
        }

        const sessionUser = nextSession?.user ?? null
        if (sessionUser) {
          const mapped = mapAuthUser(sessionUser)
          setUser(mapped)
          
          // CRITICAL: Check localStorage for cached role before loading profile
          // This ensures we preserve owner role even if profile load times out
          const cachedRole = getRoleFromLocalStorage()
          const preservedRole = cachedRole && cachedRole.uid === mapped.uid && cachedRole.role !== 'user' 
            ? cachedRole.role 
            : undefined
          
          if (preservedRole) {
            console.debug('[AuthContext] Using preserved role from localStorage:', preservedRole)
          }
          
          // Load profile with timeout - this will use fallback if it times out
          const profileResult = await loadUserProfileWithTimeout(mapped)
          
          // Sync role from auth metadata to profile (for OAuth flows and existing sessions)
          // Use a timeout to prevent hanging
          let finalProfile = profileResult.profile
          
          // CRITICAL: If profile load failed/timed out and we have a preserved role, use it
          if (profileResult.fallback && preservedRole && finalProfile) {
            // Only override if the fallback role is 'user' (default)
            if (finalProfile.role === 'user' || !finalProfile.role) {
              console.debug('[AuthContext] Profile load failed, preserving role from cache:', preservedRole)
              finalProfile.role = preservedRole
              // Update the profile state with preserved role immediately
              applyProfileToState(finalProfile, mapped)
            }
          }
          if (finalProfile) {
            try {
              // Add timeout for role reconciliation to prevent hanging
              // If it times out, we'll use the original profile
              const syncPromise = reconcileProfileAfterAuth(mapped, finalProfile)
              const timeoutPromise = new Promise<UserProfile>((_, reject) => {
                setTimeout(() => reject(new Error('ROLE_SYNC_TIMEOUT')), 5000)
              })
              
              finalProfile = await Promise.race([syncPromise, timeoutPromise])
            } catch (syncError) {
              // If sync fails or times out, use original profile
              const isTimeout = syncError instanceof Error && syncError.message === 'ROLE_SYNC_TIMEOUT'
              if (isTimeout) {
                console.debug('[AuthContext] Role sync timed out, using original profile')
              } else {
                console.warn('[AuthContext] Role sync failed during session initialization:', syncError)
              }
              // Keep original profile if sync fails - finalProfile already has the original value
            }
          }
          
          // Task C1: Re-sync with profile data after it's loaded (async, don't block)
          if (finalProfile && nextSession) {
            // Set cache immediately after profile is loaded
            setSessionCache(mapped, finalProfile, nextSession)
            
            // Also sync to server (existing code)
            void syncServerSession('SIGNED_IN', nextSession, finalProfile)
          }
        } else {
          setUser(null)
          setUserProfile(null)
          resetProfileState()
        }
      } catch (error) {
        // CRITICAL FIX: If cache exists, use it as fallback instead of clearing
        if (cachedData && isMounted) {
          console.debug('[AuthContext] Supabase initialization failed, but cache exists - using cache as fallback')
          // Cache already hydrated state above
          setLoading(false)
          isInitializing = false
          return
        }
        
        // No cache - clear everything
        console.warn('Failed to bootstrap Supabase session:', error)
        if (isMounted) {
          setUser(null)
          setUserProfile(null)
          setSession(null)
          void syncServerSession('SIGNED_OUT', null)
          resetProfileState()
        }
      } finally {
        if (isMounted) {
          // Always set loading to false, even if there were errors
          // This ensures the UI doesn't get stuck in loading state
          setLoading(false)
          isInitializing = false // Reset guard
          console.log('[AuthContext] Session initialization complete', {
            hasUser: Boolean(user),
            hasSession: Boolean(session),
            hasProfile: Boolean(userProfile),
          })
        }
      }
    }

    primeSession()

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return
      
      // CRITICAL: Ignore INITIAL_SESSION events during initialization to prevent loops
      // INITIAL_SESSION is fired when Supabase detects an existing session, but we're already handling that in primeSession
      if (event === 'INITIAL_SESSION' && isInitializing) {
        console.debug('[AuthContext] Ignoring INITIAL_SESSION during initialization')
        return
      }
      
      console.log('[AuthContext] Auth state changed:', event)
      
      // Handle token refresh failures gracefully
      if (event === 'TOKEN_REFRESHED' && !newSession) {
        // This is expected when refresh tokens expire - handle silently
        console.debug('[AuthContext] Token refresh failed (token expired), clearing session')
        void syncServerSession('SIGNED_OUT', null)
        setSession(null)
        setUser(null)
        setUserProfile(null)
        resetProfileState()
        setLoading(false)
        return
      }

      // For OAuth sign-ins, immediately sync session to server
      // This ensures cookies are set before middleware checks
      if (event === 'SIGNED_IN' && newSession) {
        console.debug('[AuthContext] OAuth sign-in detected, syncing session to server immediately')
        // Sync immediately and wait for it to complete (profile may not be loaded yet)
        try {
          await syncServerSession('SIGNED_IN', newSession, userProfile)
          console.debug('[AuthContext] Session synced to server successfully')
        } catch (error) {
          console.warn('[AuthContext] Failed to sync session to server:', error)
        }
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        // For other events, sync asynchronously
        void syncServerSession(event, newSession ?? null, userProfile)
      }

      setLoading(true)
      try {
        setSession(newSession ?? null)
        const sessionUser = newSession?.user ?? null
        if (sessionUser) {
          const mapped = mapAuthUser(sessionUser)
          setUser(mapped)
          const profileResult = await loadUserProfileWithTimeout(mapped)
          
          // Sync role from auth metadata to profile (for OAuth and auth state changes)
          if (profileResult.profile) {
            try {
              await reconcileProfileAfterAuth(mapped, profileResult.profile)
            } catch (syncError) {
              console.warn('[AuthContext] Role sync failed during auth state change:', syncError)
            }
          }
        } else {
          setUser(null)
          setUserProfile(null)
          resetProfileState()
        }
      } catch (error) {
        // Check if it's a refresh token error (expected)
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorCode = error && typeof error === 'object' && 'code' in error 
          ? String((error as { code?: string }).code)
          : ''
        
        const isRefreshTokenError = 
          errorMessage.includes('Refresh Token') ||
          errorMessage.includes('refresh_token_not_found') ||
          errorCode === 'refresh_token_not_found'
        
        if (isRefreshTokenError) {
          // Expected error when tokens expire - handle silently
          console.debug('[AuthContext] Refresh token error during auth state change, clearing session')
          setSession(null)
          setUser(null)
          setUserProfile(null)
          resetProfileState()
        } else {
          // Real error, log it
          console.error('[AuthContext] Auth state change failed:', error)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    })

    return () => {
      isMounted = false
      initializationStartedRef.current = false // Reset on cleanup
      listener.subscription.unsubscribe()
    }
  }, [supabase, getSessionCache, setSessionCache]) // Include cache functions

  useEffect(() => {
    if (!supabase || typeof window === 'undefined') return

    const handleStorage = async (event: StorageEvent) => {
      if (!event.key || !event.key.includes('-auth-token')) return

      setLoading(true)
      try {
        const { data, error: storageSessionError } = await supabase.auth.getSession()
        if (storageSessionError) {
          console.warn('[auth] storage sync session error', storageSessionError)
        }
        const nextSession = data?.session ?? null
        setSession(nextSession)
        if (nextSession) {
          void syncServerSession('SIGNED_IN', nextSession, userProfile)
        } else {
          void syncServerSession('SIGNED_OUT', null)
        }

        const sessionUser = nextSession?.user ?? null
        if (sessionUser) {
          const mapped = mapAuthUser(sessionUser)
          setUser(mapped)
          const profileResult = await loadUserProfileWithTimeout(mapped)
          
          // Sync role from auth metadata to profile (for cross-tab sync)
          let finalProfile = profileResult.profile
          if (finalProfile) {
            try {
              finalProfile = await reconcileProfileAfterAuth(mapped, finalProfile)
            } catch (syncError) {
              console.warn('[AuthContext] Role sync failed during storage sync:', syncError)
            }
          }
          
          // Re-sync with profile after it's loaded
          if (finalProfile && nextSession) {
            void syncServerSession('SIGNED_IN', nextSession, finalProfile)
          }
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

  useEffect(() => {
    if (!supabase || !user?.uid) return

    // Initialize subscription manager
    if (realtimeSubscriptionManager.getActiveSubscriptionCount() === 0) {
      realtimeSubscriptionManager.initialize(supabase)
    }

    // Subscribe with proper filtering (already filtered by user_id)
    const unsubscribe = realtimeSubscriptionManager.subscribe({
      channelName: `profile-updates-${user.uid}`,
      table: 'profiles',
      filter: `id=eq.${user.uid}`, // Critical: filter by user_id to prevent processing all profile changes
      schema: 'public',
      event: '*',
      callback: () => {
        refreshProfile().catch((error) =>
          console.warn('[AuthContext] Failed to refresh profile after realtime update:', error),
        )
      },
    })

    // Monitor connections periodically (every 5 minutes)
    const monitorInterval = setInterval(() => {
      realtimeSubscriptionManager.monitorConnections()
    }, 5 * 60 * 1000) // 5 minutes

    // Track analytics on subscription
    realtimeSubscriptionManager.trackAnalytics()

    return () => {
      unsubscribe()
      clearInterval(monitorInterval)
    }
  }, [supabase, user?.uid, refreshProfile])

  // Handle page visibility changes (browser minimized/restored)
  // SIMPLIFIED: Non-blocking, instant restoration for smooth UX
  useEffect(() => {
    if (typeof document === 'undefined') return

    const lastVisibilityStateRef = { current: document.visibilityState }

    const handleVisibilityChange = () => {
      const currentVisibility = document.visibilityState

      // Only process if visibility actually changed
      if (currentVisibility === 'visible' && lastVisibilityStateRef.current !== 'visible') {
        lastVisibilityStateRef.current = 'visible'
        
        // INSTANT, NON-BLOCKING: Reconnect subscriptions immediately
        // This never blocks rendering - all work happens in background
        if (supabase && user?.uid && userProfile?.uid === user.uid) {
          // We have valid state - just reconnect subscriptions
          // Do this asynchronously so it never blocks rendering
          void (async () => {
            try {
              realtimeSubscriptionManager.reconnectAll()
            } catch (error) {
              // Fail silently - don't break UI if reconnection fails
              console.debug('[AuthContext] Subscription reconnection failed (non-critical):', error)
            }
          })()
        } else if (supabase && user?.uid && !userProfile && !loading) {
          // Missing profile but not loading - try to restore in background
          // This is non-blocking and won't prevent rendering
          void (async () => {
            try {
              const { data: sessionData } = await supabase.auth.getSession()
              if (sessionData?.session?.user) {
                const mapped = mapAuthUser(sessionData.session.user)
                if (mapped.uid === user.uid) {
                  // Load profile in background - doesn't block rendering
                  await loadUserProfileWithTimeout(mapped)
                }
              }
            } catch (error) {
              // Fail gracefully - don't break UI
              console.debug('[AuthContext] Background profile restore failed (non-critical):', error)
            }
          })()
        }
      } else if (currentVisibility === 'hidden') {
        lastVisibilityStateRef.current = 'hidden'
      }
    }

    // Also handle window focus - same simple, non-blocking approach
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && supabase && user?.uid) {
        // Reconnect subscriptions in background - never blocks
        void (async () => {
          try {
            realtimeSubscriptionManager.reconnectAll()
          } catch (error) {
            console.debug('[AuthContext] Focus subscription reconnection failed (non-critical):', error)
          }
        })()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [supabase, user?.uid, userProfile?.uid, loadUserProfileWithTimeout, loading])

  const signIn = useCallback(
    async (email: string, password: string, captchaToken?: string): Promise<SignInResult> => {
      if (!supabase) {
        throw new Error('Supabase is not properly configured')
      }

      // Build sign-in options with CAPTCHA token if provided
      const signInOptions = captchaToken
        ? ({
            captchaToken,
          } as Parameters<typeof supabase.auth.signInWithPassword>[0]['options'] & {
            captchaToken?: string
          })
        : undefined

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: signInOptions,
      })
      if (error) {
        const message = error.message?.toLowerCase() ?? ''
        const status = error.status ?? 0
        const errorCode = (error as { code?: string; error?: string; error_description?: string }).code
        const errorDescription = (error as { error_description?: string }).error_description
        
        // Log full error details for debugging
        console.error('[AuthContext] Supabase sign-in error:', {
          status,
          message: error.message,
          code: errorCode,
          description: errorDescription,
          error: error,
        })
        
        if (message.includes('email logins are disabled')) {
          throw new Error(
            'Email/password sign-ins are disabled for this account. Please use the Google option instead.',
          )
        }
        if (message.includes('invalid login credentials') || message.includes('invalid password') || message.includes('invalid email')) {
          throw new Error('The email or password you entered is incorrect.')
        }
        
        // Provide more context for 400 errors
        if (status === 400) {
          const detailedMessage = errorDescription || error.message || 'Invalid request'
          throw new Error(
            `Authentication failed: ${detailedMessage}. ${errorCode ? `Error code: ${errorCode}` : ''}`,
          )
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
      if (session) {
        void syncServerSession('SIGNED_IN', session, null) // Profile not loaded yet
      }
      setUser(authUser)

      // CRITICAL: Check 2FA requirement BEFORE loading profile
      // This ensures 2FA is checked for all logins, not just owner logins
      // IMPORTANT: Only check 2FA during actual sign-in, not during session restoration
      // Use API route instead of direct server function calls (client component limitation)
      // The API route will check the actual role from the database profile
      try {
        console.debug('[AuthContext] Checking 2FA requirement for user', { userId: authUser.uid })
        // Use API route to check 2FA requirement and create session
        // The API will fetch the profile and check the actual role
        const twoFAResponse = await fetch('/api/auth/2fa/require', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            purpose: 'login',
            userId: authUser.uid,
          }),
        }).catch((fetchError) => {
          // Handle network errors gracefully
          console.warn('[AuthContext] Network error checking 2FA requirement:', fetchError)
          // Return a mock response to continue with normal flow
          return new Response(JSON.stringify({ required: false }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        })
        
        console.debug('[AuthContext] 2FA check response status:', twoFAResponse.status)

        if (twoFAResponse.ok) {
          const twoFAData = await twoFAResponse.json()
          
          if (twoFAData.required && twoFAData.enabled && twoFAData.sessionToken) {
            console.debug('[AuthContext] 2FA session created, signing out and requiring verification')
            
            // Sign out immediately to prevent session from being used until 2FA is verified
            try {
              await supabase.auth.signOut({ scope: 'local' })
              setSession(null)
              setUser(null)
              void syncServerSession('SIGNED_OUT', null)
            } catch (signOutError) {
              console.warn('[AuthContext] Failed to sign out after 2FA requirement:', signOutError)
            }
            
            // Return early with 2FA requirement flag
            // The login form will catch this and show 2FA modal
            return {
              user: authUser,
              profile: buildBootstrapProfile(authUser),
              session: null, // Session cleared until 2FA verified
              profileStatus: 'loading',
              profileIssueMessage: 'Two-factor authentication required',
              profileError: null,
              isProfileFallback: false,
              requires2FA: true,
              twoFASessionToken: twoFAData.sessionToken,
            }
          } else if (twoFAData.required && !twoFAData.enabled) {
            // 2FA is required but not enabled - sign out and throw error
            console.warn('[AuthContext] 2FA required but not enabled for user', { userId: authUser.uid })
            
            try {
              await supabase.auth.signOut({ scope: 'local' })
              setSession(null)
              setUser(null)
              void syncServerSession('SIGNED_OUT', null)
            } catch (signOutError) {
              console.warn('[AuthContext] Failed to sign out after 2FA requirement check:', signOutError)
            }
            
            throw new Error('2FA is required for your account but is not enabled. Please enable 2FA in your security settings before logging in.')
          }
          // If 2FA is not required, continue with normal flow
        } else if (twoFAResponse.status === 403) {
          // 2FA required but not enabled
          const errorData = await twoFAResponse.json().catch(() => ({}))
          console.warn('[AuthContext] 2FA required but not enabled', errorData)
          
          try {
            await supabase.auth.signOut({ scope: 'local' })
            setSession(null)
            setUser(null)
            void syncServerSession('SIGNED_OUT', null)
          } catch (signOutError) {
            console.warn('[AuthContext] Failed to sign out after 2FA requirement check:', signOutError)
          }
          
          throw new Error(errorData.message || '2FA is required for your account but is not enabled. Please enable 2FA in your security settings before logging in.')
        } else {
          // API error - log but continue (fallback behavior)
          // Only log if it's not a 200 (which means 2FA not required)
          if (twoFAResponse.status !== 200) {
            console.warn('[AuthContext] Failed to check 2FA requirement:', twoFAResponse.status)
            // If it's a 500 error, it's likely a temporary service issue
            // Allow login to proceed rather than blocking the user
            if (twoFAResponse.status === 500) {
              console.warn('[AuthContext] 2FA service unavailable, allowing login to proceed')
            }
          }
          // Continue with normal flow as fallback
        }
      } catch (twoFAError) {
        // If 2FA check fails, check if it's an error we should throw
        if (twoFAError instanceof Error && twoFAError.message.includes('2FA is required')) {
          throw twoFAError
        }
        // Otherwise, log error but continue with normal flow
        // This prevents login from being blocked if 2FA service is temporarily unavailable
        // Network errors (fetch failed) should not block login
        const isNetworkError = twoFAError instanceof TypeError && 
          (twoFAError.message.includes('fetch failed') || twoFAError.message.includes('Failed to fetch'))
        
        if (isNetworkError) {
          console.warn('[AuthContext] Network error checking 2FA requirement - allowing login to proceed:', twoFAError)
        } else {
          console.error('[AuthContext] Error checking 2FA requirement:', twoFAError)
        }
        // Continue with normal flow as fallback - don't block login
      }

      // Continue with normal flow for users who don't require 2FA or have completed 2FA
      const profileOutcome = await loadUserProfileWithTimeout(authUser)
      // Task C1: Re-sync with profile after it's loaded
      if (profileOutcome.profile && session) {
        void syncServerSession('SIGNED_IN', session, profileOutcome.profile)
      }

      let finalProfile = profileOutcome.profile
      let finalStatus = profileOutcome.status
      let finalMessage = profileOutcome.message
      let finalError = profileOutcome.error
      let finalFallback = profileOutcome.fallback

      try {
        finalProfile = await reconcileProfileAfterAuth(authUser, profileOutcome.profile)
      } catch (syncError) {
        const normalisedSyncError = normaliseError(syncError, 'Profile sync failed')
        console.error('[AuthContext] Post-sign-in profile sync failed:', syncError)
        setProfileStatus('error')
        setProfileError(normalisedSyncError)
        setProfileIssueMessage((current) => current ?? PROFILE_SYNC_SUPPORT_MESSAGE)
        setIsProfileFallback(true)
        finalStatus = 'error'
        finalError = normalisedSyncError
        finalMessage = PROFILE_SYNC_SUPPORT_MESSAGE
        finalFallback = true
      }

      return {
        user: authUser,
        profile: finalProfile,
        session,
        profileStatus: finalStatus,
        profileIssueMessage: finalMessage,
        profileError: finalError,
        isProfileFallback: finalFallback,
        requires2FA: false,
      }
    },
    [
      supabase,
      loadUserProfileWithTimeout,
      reconcileProfileAfterAuth,
      setProfileStatus,
      setProfileError,
      setProfileIssueMessage,
      setIsProfileFallback,
    ],
  )

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string, captchaToken?: string) => {
      if (!supabase) throw new Error('Supabase is not properly configured')

      // Build sign-up options with CAPTCHA token if provided
      const signUpOptions: {
        data: {
          display_name: string | null
        }
        captchaToken?: string
      } = {
        data: {
          display_name: displayName ?? null,
        },
      }

      // Include CAPTCHA token if provided
      if (captchaToken) {
        signUpOptions.captchaToken = captchaToken
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: signUpOptions as Parameters<typeof supabase.auth.signUp>[0]['options'] & { captchaToken?: string },
      })
      
      if (error) {
        const message = error.message?.toLowerCase() ?? ''
        const status = error.status ?? 0
        const errorCode = (error as { code?: string; error?: string; error_description?: string }).code
        const errorDescription = (error as { error_description?: string }).error_description
        
        // Log full error details for debugging
        console.error('[AuthContext] Supabase sign-up error:', {
          status,
          message: error.message,
          code: errorCode,
          description: errorDescription,
          error: error,
        })
        
        // Provide more context for 400 errors
        if (status === 400) {
          const detailedMessage = errorDescription || error.message || 'Invalid request'
          throw new Error(
            `Sign-up failed: ${detailedMessage}. ${errorCode ? `Error code: ${errorCode}` : ''}`,
          )
        }
        
        throw error
      }

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
        role: bootstrap.role, // Use role from bootstrap (which checks auth metadata)
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
      // Clear client-side state first to prevent UI flicker
      setSession(null)
      setUser(null)
      setUserProfile(null)
      resetProfileState()
      // Task A2: Clear role cookies and localStorage
      clearRoleStorage()
      
      // Then sign out from Supabase (clears client-side auth)
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      }
      
      // Finally, sync the logout to server to clear server-side session
      // Wait for this to complete to ensure server session is cleared before redirect
      try {
        await syncServerSession('SIGNED_OUT', null)
      } catch (syncError) {
        // Log but don't throw - server session clearing is best effort
        // The client-side logout is more important
        console.warn('[AuthContext] Failed to sync logout to server:', syncError)
      }
    } catch (error) {
      const tokenError =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: string }).message === 'string' &&
        (error as { message: string }).message.includes('Refresh Token Not Found')
      if (!tokenError) {
        // Even if logout fails, clear local state
        setSession(null)
        setUser(null)
        setUserProfile(null)
        resetProfileState()
        throw error
      }
    }
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
      await refreshProfile()
    },
    [supabase, user, userProfile, applyProfileToState, refreshProfile],
  )

  // Ensure role is always valid, defaulting to 'user' if undefined
  const role = normaliseRole(userProfile?.role ?? user?.role ?? DEFAULT_ROLE)
  // Ensure roleMeta always has valid values with fallbacks
  const roleMeta = useMemo(() => {
    const meta = getRoleMeta(role)
    // Double-check that all required fields exist
    return {
      id: meta.id ?? DEFAULT_ROLE,
      label: meta.label ?? 'User',
      shortLabel: meta.shortLabel ?? 'User',
      defaultRoute: meta.defaultRoute ?? '/',
      onboardingRoute: meta.onboardingRoute ?? '/profile',
      welcomeTitle: meta.welcomeTitle ?? 'Welcome!',
      welcomeSubtitle: meta.welcomeSubtitle ?? 'Get started by exploring the platform.',
      icon: meta.icon ?? 'sparkles',
    }
  }, [role])
  const isVendor = role === 'vendor'

  const isSupabaseEnabled = Boolean(supabase)

  const contextValue: AuthContextType = {
    user,
    userProfile,
    profile: userProfile,
    role,
    roleMeta,
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
