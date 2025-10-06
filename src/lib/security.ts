import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

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
  if (typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return (error as { message: string }).message
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
  if (code && FORBIDDEN_CODES.has(code)) {
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
  return error instanceof Error ? error : new Error('Unexpected error occurred')
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

export function sanitizeText(input: string, options?: { maxLength?: number; allowNewlines?: boolean }): string {
  const maxLength = options?.maxLength ?? 280
  const allowNewlines = options?.allowNewlines ?? false
  const pattern = allowNewlines ? /[^\x20-\x7E\n\r]/g : /[^\x20-\x7E]/g
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
'
