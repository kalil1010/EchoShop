import type { SupabaseClient, User } from '@supabase/supabase-js'
import { normaliseRole } from '@/lib/roles'
import type { UserProfile } from '@/types/user'

export type PermissionReason = 'auth' | 'forbidden'

export class PermissionError extends Error {
  readonly reason: PermissionReason

  constructor(reason: PermissionReason, message: string) {
    super(message)
    this.name = 'PermissionError'
    this.reason = reason
  }
}

const AUTH_CODES = new Set(['401', 401, '403', 403, 'PGRST301', 'PGRST302'])
const FORBIDDEN_CODES = new Set(['42501', 'PGRST303', 'PGRST305'])

function extractCode(error: unknown): string | number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const candidate = error as { status?: number; statusCode?: number; code?: string | number }
  return candidate.code ?? candidate.status ?? candidate.statusCode
}

function extractMessage(error: unknown): string {
  if (!error) return ''
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const candidate = (error as { message?: unknown }).message
    if (typeof candidate === 'string') {
      return candidate
    }
  }
  return ''
}

export function classifySupabaseError(error: unknown): PermissionReason | 'other' {
  const code = extractCode(error)
  const message = extractMessage(error).toLowerCase()
  if (code && AUTH_CODES.has(code)) {
    if (Number(code) === 403) return 'forbidden'
    return 'auth'
  }
  if (typeof code === 'string' && FORBIDDEN_CODES.has(code)) {
    return 'forbidden'
  }
  if (message.includes('permission denied') || message.includes('rls')) {
    return 'forbidden'
  }
  if (message.includes('auth') || message.includes('jwt') || message.includes('session')) {
    return 'auth'
  }
  return 'other'
}

export function mapSupabaseError(error: unknown): Error {
  const classification = classifySupabaseError(error)
  if (classification === 'auth') {
    console.warn('[supabase] authentication required', error)
    return new PermissionError('auth', 'You must be logged in to continue.')
  }
  if (classification === 'forbidden') {
    console.warn('[supabase] action forbidden', error)
    return new PermissionError('forbidden', 'You are not authorized to perform this action.')
  }
  if (error instanceof Error) return error
  const fallback = extractMessage(error)
  return new Error(fallback || 'Unexpected error occurred')
}

export async function requireSessionUser(supabase: SupabaseClient, expectedUserId?: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    throw mapSupabaseError(error)
  }
  const sessionUser = data?.user
  if (!sessionUser) {
    throw new PermissionError('auth', 'You must be logged in to continue.')
  }
  if (expectedUserId && sessionUser.id !== expectedUserId) {
    throw new PermissionError('forbidden', 'You are not authorized to access this resource.')
  }
  return sessionUser.id
}

export async function requireRole(
  supabase: SupabaseClient,
  allowedRoles: string | string[],
): Promise<{ user: User; profile: UserProfile }> {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    throw mapSupabaseError(error)
  }
  if (!session) {
    throw new PermissionError('auth', 'You must be logged in to continue.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single<UserProfile>()

  if (profileError) {
    throw mapSupabaseError(profileError)
  }

  if (!profile) {
    throw new PermissionError('forbidden', 'User profile not found.')
  }

  const roles = Array.isArray(allowedRoles) ? allowedRoles.map(normaliseRole) : [normaliseRole(allowedRoles)]
  const profileRole = normaliseRole(profile.role)
  if (!roles.includes(profileRole)) {
    throw new PermissionError('forbidden', 'You do not have permission to access this resource.')
  }

  return { user: session.user, profile: { ...profile, role: profileRole } }
}

export function sanitizeText(input: string, options?: { maxLength?: number; allowNewlines?: boolean }): string {
  const maxLength = options?.maxLength ?? 280
  const allowNewlines = options?.allowNewlines ?? false
  const pattern = allowNewlines ? /[^ -~\n\r]/g : /[^ -~]/g
  return input
    .normalize('NFKC')
    .replace(pattern, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function isPermissionError(error: unknown): error is PermissionError {
  return error instanceof PermissionError
}
