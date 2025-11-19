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
import {
  clearSessionCache,
  persistSessionCache,
  readSessionCache,
  recoverSessionCacheSnapshot,
  type SessionCacheData,
} from '@/lib/sessionCache'

// Cache TTL constant - matches sessionCache.ts
const SESSION_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

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
  usingCache: boolean
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

const DEFAULT_PROFILE_TIMEOUT_MS = 30000 // 30 seconds - increased for better reliability on slower connections

const PERMISSION_ISSUE_MESSAGE =
  'Profile loading failed due to database permission issues. Please contact support or retry later.'
const TIMEOUT_ISSUE_MESSAGE =
  'Profile loading is taking longer than expected. This could be due to network latency or high server load. Your session is active, and we\'re retrying in the background. You can continue using the app with basic features.'
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
  const [usingCache, setUsingCache] = useState(false)

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
        // CRITICAL FIX #5: Check vendor status even when Supabase is unavailable
        // Use cached vendor status if available
        let vendorStatus: 'approved' | 'pending' | null = null
        const cachedSession = readSessionCache()
        if (cachedSession && cachedSession.user.uid === authUser.uid && cachedSession.profile.role === 'vendor') {
          vendorStatus = 'approved'
        }
        const fallback = buildBootstrapProfile(authUser, vendorStatus)
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
        const startTime = Date.now()
        const { data } = await withRetry(async () => {
          const response = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.uid)
            .maybeSingle<ProfileRow>()

          if (response.error && response.error.code !== 'PGRST116') {
            const duration = Date.now() - startTime
            console.error(
              `[AuthContext] Profile fetch error for ${authUser.uid} (took ${duration}ms):`,
              response.error,
            )
            throw response.error
          }

          if (!response.data) {
            console.debug(
              `[AuthContext] Profile fetch returned no data for ${authUser.uid}.`,
            )
          } else {
            const duration = Date.now() - startTime
            console.debug(`[AuthContext] Profile fetched in ${duration}ms`)
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
        // CRITICAL FIX #5: Check vendor status before building fallback
        let vendorStatus: 'approved' | 'pending' | null = null
        if (supabase) {
          try {
            vendorStatus = await checkVendorStatus(supabase, authUser.uid)
          } catch (vendorError) {
            console.debug('[AuthContext] Vendor status check failed during error handling (non-critical):', vendorError)
          }
        }
        const fallback = buildBootstrapProfile(authUser, vendorStatus)
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
        
        // CRITICAL FIX #4: Preserve existing role - check session cache FIRST (most recent)
        let preservedRole: UserRole | undefined = undefined
        
        // 1. Check session cache FIRST (most recent and reliable)
        const cachedSession = readSessionCache()
        if (cachedSession && cachedSession.user.uid === authUser.uid) {
          preservedRole = cachedSession.profile.role
          console.debug('[AuthContext] Preserving role from session cache:', preservedRole)
        }
        
        // 2. Fall back to localStorage vendor status
        if (!preservedRole) {
          const lastKnownRole = getRoleFromLocalStorage()
          if (lastKnownRole && lastKnownRole.uid === authUser.uid && lastKnownRole.role !== 'user') {
            preservedRole = lastKnownRole.role
            console.debug('[AuthContext] Preserving role from localStorage:', preservedRole)
          }
        }
        
        // 3. Fall back to current userProfile
        if (!preservedRole && userProfile && userProfile.uid === authUser.uid && userProfile.role !== 'user') {
          preservedRole = userProfile.role
          console.debug('[AuthContext] Preserving role from current profile:', preservedRole)
        }
        
        // CRITICAL FIX #5: Check vendor status before building bootstrap profile
        let vendorStatus: 'approved' | 'pending' | null = null
        if (supabase && (!preservedRole || preservedRole === 'user')) {
          try {
            vendorStatus = await checkVendorStatus(supabase, authUser.uid)
          } catch (error) {
            console.debug('[AuthContext] Vendor status check failed during timeout (non-critical):', error)
          }
        }
        
        const fallback = buildBootstrapProfile(authUser, vendorStatus)
        // Override role if we have a preserved role
        if (preservedRole) {
          fallback.role = preservedRole
          console.debug('[AuthContext] Preserving role on timeout:', preservedRole)
        }
        const profile = applyProfileToState(fallback, authUser)
        if (timeoutIssue) {
          // Aggressively retry in background with increasing delays
          // This gives the database multiple chances to respond
          const retryWithDelay = (delay: number, attempt: number) => {
            if (attempt > 4) {
              // Max 4 retries (1s, 2s, 4s, 8s) - total ~15s additional wait time
              console.debug('[AuthContext] Background retries exhausted, profile will remain in fallback mode')
              return
            }
            setTimeout(() => {
              console.debug(`[AuthContext] Background retry attempt ${attempt} after ${delay}ms`)
              loadUserProfile(authUser)
                .then((result) => {
                  if (result.status === 'ready' && !result.fallback) {
                    console.log('[AuthContext] Background retry succeeded, profile loaded and synced')
                    // Profile loaded successfully - update state to reflect ready status
                    setProfileStatus('ready')
                    setProfileError(null)
                    setProfileIssueMessage(null)
                    setIsProfileFallback(false)
                    // applyProfileToState is already called in loadUserProfile result
                  } else if (result.status === 'degraded' && !result.fallback) {
                    // Partial success - update status but keep fallback flag
                    console.log('[AuthContext] Background retry partially succeeded')
                    setProfileStatus('degraded')
                    setIsProfileFallback(result.fallback || false)
                  } else {
                    // Retry with exponential backoff: 1s, 2s, 4s, 8s
                    retryWithDelay(delay * 2, attempt + 1)
                  }
                })
                .catch((error) => {
                  console.debug(`[AuthContext] Background retry attempt ${attempt} failed:`, error)
                  // Retry with exponential backoff: 1s, 2s, 4s, 8s
                  retryWithDelay(delay * 2, attempt + 1)
                })
            }, delay)
          }
          retryWithDelay(1000, 1) // Start with 1 second delay for faster recovery
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
    [loadUserProfile, applyProfileToState, getRoleFromLocalStorage, userProfile, supabase],
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
  const initializationInProgressRef = useRef(false)
  const profileLoadInProgressRef = useRef(false)

  useEffect(() => {
    if (!supabase) {
      setUser(null)
      setUserProfile(null)
      setSession(null)
      resetProfileState()
      setLoading(false)
      initializationStartedRef.current = false
      initializationInProgressRef.current = false
      return
    }

    // CRITICAL: Prevent effect from running multiple times
    // Check both started AND in-progress to prevent race conditions
    if (initializationStartedRef.current || initializationInProgressRef.current) {
      console.debug('[AuthContext] Initialization already started or in progress, skipping effect re-run')
      return
    }

    let isMounted = true

    const primeSession = async () => {
      // CRITICAL: Prevent multiple simultaneous initializations with double-check
      if (initializationInProgressRef.current) {
        console.debug('[AuthContext] Session initialization already in progress, skipping...')
        return
      }
      
      initializationInProgressRef.current = true
      initializationStartedRef.current = true
      console.log('[AuthContext] Starting session initialization')
      
      // CRITICAL FIX: Check cache FIRST and restore immediately
      // This enables instant UI rendering on refresh
      let cachedData: SessionCacheData | null = null
      let hasCachedData = false
      if (typeof window !== 'undefined') {
        cachedData = readSessionCache()
        if (cachedData) {
          hasCachedData = true
          console.debug('[AuthContext] Found valid session cache, restoring immediately')
          // CRITICAL: Ensure role is in user object when restoring from cache
          // This fixes the role persistence issue on refresh
          const cachedUserWithRole = {
            ...cachedData.user,
            role: cachedData.profile.role, // Ensure role is always set from profile
          }
          // Hydrate from cache immediately for instant UI
          setUser(cachedUserWithRole)
          setUserProfile(cachedData.profile)
          setLoading(false) // CRITICAL: Set loading to false immediately with cache
          // CRITICAL: Set profileStatus to 'ready' when restoring from cache
          // This prevents profileStatus from being stuck on 'loading'
          setProfileStatus('ready')
          setProfileError(null)
          setProfileIssueMessage(null)
          setIsProfileFallback(false)
          // OPTIONAL: Show cache indicator
          setUsingCache(true)
          // Clear indicator after background session restore completes
          setTimeout(() => setUsingCache(false), 5000)
          // Continue in background to verify with Supabase
        } else {
          // No cache - show loading state
          setLoading(true)
        }
      } else {
        setLoading(true)
      }
      try {
        // Task A2: Try to load role from localStorage for faster hydration
        const cachedRole = getRoleFromLocalStorage()
        if (cachedRole) {
          console.debug('[AuthContext] Found cached role in localStorage:', cachedRole.role)
        }

        // CRITICAL FIX: Add timeout to prevent hanging on getSession()
        // If Supabase hangs, we need to fall back to cache or fail gracefully
        const SESSION_TIMEOUT_MS = 20000 // 20 second timeout - give more time for slow connections
        let timeoutId: NodeJS.Timeout | null = null
        
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('SESSION_TIMEOUT'))
          }, SESSION_TIMEOUT_MS)
        })
        
        let sessionResult: { data: { session: Session | null }, error: Error | null }
        try {
          const result = await Promise.race([sessionPromise, timeoutPromise])
          if (timeoutId) clearTimeout(timeoutId)
          sessionResult = result as typeof sessionResult
        } catch (timeoutError) {
          if (timeoutId) clearTimeout(timeoutId)
          if (timeoutError instanceof Error && timeoutError.message === 'SESSION_TIMEOUT') {
            console.warn('[AuthContext] getSession() timed out after 20s - this may indicate network issues')
            
            // IMPROVED: If we have valid cache, use it and continue without redirecting
            // This prevents the "content disappearing" issue on slow connections
            if (hasCachedData && cachedData) {
              const cacheAge = Date.now() - cachedData.timestamp
              // Use cache if it's reasonably fresh (< 10 minutes - matching TTL)
              if (cacheAge < SESSION_CACHE_TTL) {
                console.debug('[AuthContext] Using cache after timeout - session will be restored in background')
                if (isMounted) {
                  // CRITICAL: Ensure role is in user object when restoring from cache
                  const cachedUserWithRole = {
                    ...cachedData.user,
                    role: cachedData.profile.role,
                  }
                  setUser(cachedUserWithRole)
                  setUserProfile(cachedData.profile)
                  setLoading(false)
                  // CRITICAL: Set profileStatus to 'ready' when restoring from cache after timeout
                  setProfileStatus('ready')
                  setProfileError(null)
                  setProfileIssueMessage(null)
                  setIsProfileFallback(false)
                  // OPTIONAL: Show cache indicator
                  setUsingCache(true)
                  // Clear indicator after background session restore completes
                  setTimeout(() => setUsingCache(false), 5000)
                  
                  // Try to restore session in background with retry
                  // This is non-blocking and won't cause redirect if it fails
                  const retrySessionRestore = async (attempt = 1, maxAttempts = 3) => {
                    try {
                      const { data, error } = await supabase.auth.getSession()
                      if (data?.session && isMounted) {
                        console.debug('[AuthContext] Background session restored successfully')
                        setSession(data.session)
                        void syncServerSession('SIGNED_IN', data.session, cachedData.profile)
                      } else if (error && attempt < maxAttempts) {
                        // Retry after delay
                        console.debug(`[AuthContext] Retrying session restore (attempt ${attempt + 1}/${maxAttempts})`)
                        setTimeout(() => retrySessionRestore(attempt + 1, maxAttempts), 3000 * attempt)
                      }
                    } catch (err) {
                      if (attempt < maxAttempts) {
                        setTimeout(() => retrySessionRestore(attempt + 1, maxAttempts), 3000 * attempt)
                      }
                      // Fail silently - user can continue with cached data
                    }
                  }
                  
                  void retrySessionRestore()
                }
                return
              }
            }
            
            // No valid cache - this is likely first login with network issues
            // Try one more time with a longer timeout before giving up
            console.warn('[AuthContext] No valid cache after timeout, attempting final retry')
            try {
              const finalAttempt = await Promise.race([
                supabase.auth.getSession(),
                new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('FINAL_TIMEOUT')), 10000)
                )
              ]) as Awaited<ReturnType<typeof supabase.auth.getSession>>
              
              if (finalAttempt.data?.session && isMounted) {
                console.debug('[AuthContext] Final retry successful')
                sessionResult = finalAttempt
                // Continue with normal flow below
              } else {
                throw new Error('FINAL_TIMEOUT')
              }
            } catch (finalError) {
              // Give up and clean up
              console.error('[AuthContext] All session restore attempts failed')
              try {
                await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
                clearSessionCache()
                await syncServerSession('SIGNED_OUT', null).catch(() => {})
              } catch (cleanupError) {
                console.warn('[AuthContext] Error during session cleanup:', cleanupError)
              }
              
              if (isMounted) {
                // CRITICAL: Don't clear user/profile if we restored from cache earlier
                // Only clear if we never had cache
                if (!hasCachedData) {
                  setUser(null)
                  setUserProfile(null)
                  setSession(null)
                  resetProfileState()
                } else {
                  // Keep cached user/profile, just mark as no session
                  console.debug('[AuthContext] Keeping cached user/profile despite session timeout')
                  setSession(null)
                }
                setLoading(false)
              }
              return // Don't throw - gracefully degrade instead
            }
          } else {
            throw timeoutError
          }
        }
        
        const { data, error: sessionError } = sessionResult
        if (sessionError) {
          const message = typeof sessionError.message === 'string' ? sessionError.message : ''
          const code = getErrorCode(sessionError) ?? ''
          
          // Handle refresh token errors gracefully - these are expected when tokens expire
          // CRITICAL: Check for refresh token errors - these are expected when tokens expire
          const isRefreshTokenError = 
            code === 'refresh_token_not_found' ||
            (code === '400' && message.includes('Refresh Token')) ||
            message.includes('Refresh Token Not Found') ||
            message.includes('refresh_token_not_found') ||
            (sessionError && typeof sessionError === 'object' && '__isAuthError' in sessionError && code === 'refresh_token_not_found')
          
          if (isRefreshTokenError || (message.includes('Refresh Token') || message.includes('Invalid'))) {
          // CRITICAL FIX: If cache exists, use it as fallback instead of clearing
          if (hasCachedData && cachedData) {
            console.debug('[AuthContext] Supabase session failed, but cache exists - using cache as fallback')
            // CRITICAL: Ensure role is in user object when using cache as fallback
            const cachedUserWithRole = {
              ...cachedData.user,
              role: cachedData.profile.role,
            }
            if (isMounted) {
              setUser(cachedUserWithRole)
              setUserProfile(cachedData.profile)
              setLoading(false)
            }
            // Try to get session in background, but don't block
            supabase.auth.getSession()
              .then(({ data }) => {
                if (data?.session && isMounted) {
                  setSession(data.session)
                  void syncServerSession('SIGNED_IN', data.session, cachedData.profile)
                }
              })
              .catch(() => {
                // Session retrieval failed - use cache without session
                console.debug('[AuthContext] Using cache without session - will restore on next interaction')
              })
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
              clearSessionCache()
            }
            return
          }
          
          // For other errors, if cache exists, use it as fallback
          if (hasCachedData && cachedData) {
            console.debug('[AuthContext] Supabase session error, but cache exists - using cache as fallback')
            // CRITICAL: Ensure role is in user object when using cache as fallback
            const cachedUserWithRole = {
              ...cachedData.user,
              role: cachedData.profile.role,
            }
            if (isMounted) {
              setUser(cachedUserWithRole)
              setUserProfile(cachedData.profile)
              setLoading(false)
            }
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
          
          // CRITICAL: Check localStorage for cached role before loading profile
          // This ensures we preserve owner role even if profile load times out
          const cachedRole = getRoleFromLocalStorage()
          const preservedRole = cachedRole && cachedRole.uid === mapped.uid && cachedRole.role !== 'user' 
            ? cachedRole.role 
            : undefined
          
          if (preservedRole) {
            console.debug('[AuthContext] Using preserved role from localStorage:', preservedRole)
            // Set role in user object immediately for better UX
            mapped.role = preservedRole
          }
          
          // CRITICAL FIX: Check vendor status EARLIER (before profile load)
          // This ensures vendor role upgrade happens even if profile load times out
          if ((!mapped.role || mapped.role === 'user') && supabase) {
            try {
              const vendorStatus = await checkVendorStatus(supabase, mapped.uid)
              if (vendorStatus === 'approved') {
                console.debug('[AuthContext] Upgrading to vendor role before profile load', { userId: mapped.uid })
                mapped.role = 'vendor'
                // Cache immediately with vendor role to enable instant restoration
                const bootstrapProfile = buildBootstrapProfile(mapped, vendorStatus)
                persistSessionCache(mapped, bootstrapProfile)
              }
            } catch (vendorCheckError) {
              // Non-critical - continue with profile load even if vendor check fails
              console.debug('[AuthContext] Vendor status check failed (non-critical):', vendorCheckError)
            }
          }
          
          // CRITICAL FIX #1: Don't setUser yet - wait for profile to load first
          // This prevents caching user object without role
          
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
            }
          }
          
          // CRITICAL FIX #1: NOW set user with role from profile (before reconciliation)
          if (finalProfile) {
            const userWithRole = {
              ...mapped,
              role: finalProfile.role,
            }
            setUser(userWithRole) // Set once with correct role
            
            try {
              // Add timeout for role reconciliation to prevent hanging
              // If it times out, we'll use the original profile
              const syncPromise = reconcileProfileAfterAuth(mapped, finalProfile)
              const timeoutPromise = new Promise<UserProfile>((_, reject) => {
                setTimeout(() => reject(new Error('ROLE_SYNC_TIMEOUT')), 5000)
              })
              
              finalProfile = await Promise.race([syncPromise, timeoutPromise])
              
              // Update user with final role after reconciliation
              const finalUserWithRole = {
                ...mapped,
                role: finalProfile.role,
              }
              setUser(finalUserWithRole)
              
              // Cache with final profile and role
              if (nextSession) {
                persistSessionCache(finalUserWithRole, finalProfile)
                void syncServerSession('SIGNED_IN', nextSession, finalProfile)
              }
            } catch (syncError) {
              // If sync fails or times out, use original profile
              const isTimeout = syncError instanceof Error && syncError.message === 'ROLE_SYNC_TIMEOUT'
              if (isTimeout) {
                console.debug('[AuthContext] Role sync timed out, using original profile')
              } else {
                console.warn('[AuthContext] Role sync failed during session initialization:', syncError)
              }
              // Cache with original profile if sync fails
              if (nextSession) {
                const userWithRole = {
                  ...mapped,
                  role: finalProfile.role,
                }
                persistSessionCache(userWithRole, finalProfile)
                void syncServerSession('SIGNED_IN', nextSession, finalProfile)
              }
            }
          }
        } else {
          setUser(null)
          setUserProfile(null)
          resetProfileState()
        }
      } catch (error) {
        // CRITICAL FIX: If cache exists, use it as fallback instead of clearing
        if (hasCachedData && cachedData && isMounted) {
          console.debug('[AuthContext] Supabase initialization failed, but cache exists - using cache as fallback')
          // CRITICAL: Ensure role is in user object when using cache as fallback
          const cachedUserWithRole = {
            ...cachedData.user,
            role: cachedData.profile.role,
          }
          setUser(cachedUserWithRole)
          setUserProfile(cachedData.profile)
          setLoading(false)
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
          // CRITICAL: Only set loading to false if we don't have cached data
          // If we have cache, loading was already set to false above
          if (!hasCachedData) {
            setLoading(false)
          }
          initializationInProgressRef.current = false // Reset guard
          // CRITICAL: Use current state values, not closure values
          // The closure might have stale values, so check the actual state
          console.log('[AuthContext] Session initialization complete', {
            hasUser: Boolean(user),
            hasSession: Boolean(session),
            hasProfile: Boolean(userProfile),
            usedCache: hasCachedData,
            cacheUser: cachedData?.user?.uid,
            cacheProfile: cachedData?.profile?.uid,
          })
        }
      }
    }

    primeSession()

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return
      
      // CRITICAL: Ignore INITIAL_SESSION events completely to prevent loops
      // INITIAL_SESSION is fired when Supabase detects an existing session, but we're already handling that in primeSession
      // It can fire AFTER initialization completes, causing infinite loops
      if (event === 'INITIAL_SESSION') {
        console.debug('[AuthContext] Ignoring INITIAL_SESSION event (handled in primeSession)')
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

      // CRITICAL FIX: If we already have a user and session matches, don't reload everything
      // This prevents infinite loops when SIGNED_IN fires multiple times
      if (event === 'SIGNED_IN' && newSession && user && session && newSession.user.id === user.uid) {
        console.debug('[AuthContext] SIGNED_IN event for existing session, skipping reload')
        // Just update session if needed, but don't reload profile
        setSession(newSession)
        setLoading(false)
        return
      }

      // CRITICAL FIX: Prevent concurrent profile loads
      // If profile is already loading, skip this event to prevent infinite loops
      if (profileLoadInProgressRef.current && event === 'SIGNED_IN') {
        console.debug('[AuthContext] Profile load already in progress, skipping duplicate SIGNED_IN event')
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
          
          // Mark profile load as in progress
          profileLoadInProgressRef.current = true
          
          try {
            const profileResult = await loadUserProfileWithTimeout(mapped)
            
            // CRITICAL: Ensure profileStatus is set even if profile load fails
            // loadUserProfileWithTimeout should set this, but ensure it's not stuck on 'loading'
            if (profileResult.status === 'loading') {
              // This shouldn't happen, but if it does, set to degraded
              setProfileStatus('degraded')
              setIsProfileFallback(true)
            }
            
            // Sync role from auth metadata to profile (for OAuth and auth state changes)
            if (profileResult.profile) {
              try {
                await reconcileProfileAfterAuth(mapped, profileResult.profile)
              } catch (syncError) {
                console.warn('[AuthContext] Role sync failed during auth state change:', syncError)
              }
            }
          } finally {
            // Always clear the flag when done
            profileLoadInProgressRef.current = false
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
      // DON'T reset initializationStartedRef on cleanup - it should persist
      // Only reset on unmount of the entire provider
      listener.subscription.unsubscribe()
    }
  }, [supabase])

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

  // CRITICAL FIX: Client-side cookie cleanup for stale cookies
  // When user is definitely logged out, schedule cleanup of stale auth cookies
  useEffect(() => {
    if (!user && session === null && !loading && typeof window !== 'undefined') {
      // User is definitely logged out - schedule cookie cleanup
      const cleanupId = setTimeout(() => {
        // Call the auth callback endpoint to clear stale cookies
        // This is best-effort and won't block if it fails
        fetch('/api/auth/callback', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'SIGNED_OUT', session: null }),
        })
          .catch(() => {
            // Ignore errors - cleanup is best-effort
            // Cookies will be cleared on next login or by middleware
          })
      }, 5000) // Wait 5 seconds to be sure user is logged out
      
      return () => clearTimeout(cleanupId)
    }
  }, [user, session, loading])

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
        
        const recovered = recoverSessionCacheSnapshot()
        if (recovered && (!user || !userProfile)) {
          console.debug('[AuthContext] Restored session state from backup cache after visibility change')
          // CRITICAL FIX #3: Force update - don't use previous if it exists without profile
          const recoveredUserWithRole = {
            ...recovered.user,
            role: recovered.profile.role,
          }
          // Direct assignment, not callback - ensures role is always set
          setUser(recoveredUserWithRole)
          setUserProfile(recovered.profile)
          setLoading(false)
          // Re-cache to refresh timestamp
          persistSessionCache(recoveredUserWithRole, recovered.profile)
        }
        
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
        if (!userProfile) {
          const recovered = recoverSessionCacheSnapshot()
          if (recovered) {
            console.debug('[AuthContext] Restored session state from backup cache on focus')
            // CRITICAL FIX #3: Force update - don't use previous if it exists without profile
            const recoveredUserWithRole = {
              ...recovered.user,
              role: recovered.profile.role,
            }
            // Direct assignment, not callback - ensures role is always set
            setUser(recoveredUserWithRole)
            setUserProfile(recovered.profile)
            setLoading(false)
            // Re-cache to refresh timestamp
            persistSessionCache(recoveredUserWithRole, recovered.profile)
          }
        }
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

      // Load user profile
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

      // CRITICAL FIX #2: Ensure role is in user object and update state BEFORE caching
      const authUserWithRole = {
        ...authUser,
        role: finalProfile.role,
      }
      
      // Update state immediately with role (before caching)
      setUser(authUserWithRole)
      setUserProfile(finalProfile)
      
      // Cache immediately after successful login to enable instant restoration on refresh
      if (finalProfile && session) {
        persistSessionCache(authUserWithRole, finalProfile)
      }

      return {
        user: authUserWithRole,
        profile: finalProfile,
        session,
        profileStatus: finalStatus,
        profileIssueMessage: finalMessage,
        profileError: finalError,
        isProfileFallback: finalFallback,
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
      clearSessionCache()
      
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

      // CRITICAL: Filter payload to remove any columns that might not exist in DB
      const filteredRow = filterProfilePayload(row)
      
      const { error } = await supabase.from('profiles').upsert(filteredRow, { onConflict: 'id' })
      if (error) {
        console.error('[AuthContext] Profile update failed:', error)
        // Check if it's a missing column error
        const missingColumn = extractMissingProfileColumn(error)
        if (missingColumn) {
          console.warn(`[AuthContext] Missing column detected: ${missingColumn}, retrying without it`)
          // Disable the column and retry
          disableOptionalProfileColumn(missingColumn)
          const retryRow = filterProfilePayload(row)
          const { error: retryError } = await supabase.from('profiles').upsert(retryRow, { onConflict: 'id' })
          if (retryError) {
            console.error('[AuthContext] Profile update retry failed:', retryError)
            throw retryError
          }
        } else {
          throw error
        }
      }

      // Update state immediately (optimistic update)
      applyProfileToState(merged, user)
      
      // CRITICAL: Update cache immediately after profile update to ensure role persists on refresh
      const userWithRole = {
        ...user,
        role: merged.role,
      }
      persistSessionCache(userWithRole, merged)
      
      // Refresh profile in background (non-blocking) to get latest from DB
      // Don't await - let it happen in background so UI updates immediately
      refreshProfile().catch((refreshError) => {
        console.warn('[AuthContext] Background profile refresh failed (non-critical):', refreshError)
        // Non-critical - we already updated state optimistically
      })
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
    usingCache,
  }

  // OPTIONAL: Health check logging in development mode
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    const healthCheck = setInterval(() => {
      const cache = readSessionCache()
      console.table({
        'User ID': user?.uid || 'null',
        'Profile ID': userProfile?.uid || 'null',
        'Role': role,
        'Loading': loading,
        'Profile Status': profileStatus,
        'Has Cache': cache ? 'Yes' : 'No',
        'Cache Role': cache?.profile?.role || 'N/A',
        'User Role in Object': user?.role || 'undefined',
        'Using Cache': usingCache ? 'Yes' : 'No',
      })
    }, 10000) // Every 10 seconds in dev

    return () => clearInterval(healthCheck)
  }, [user, userProfile, role, loading, profileStatus, usingCache])

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
