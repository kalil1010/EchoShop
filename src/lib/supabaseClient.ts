import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type SupabaseClientType = SupabaseClient

let browserClient: SupabaseClientType | null = null

const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

// CRITICAL FIX: Create a fetch wrapper with timeout support
// This prevents Supabase requests from hanging indefinitely
function createTimeoutFetch(timeoutMs: number = 15000) {
  return async (url: string, init?: RequestInit) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

function createSupabaseClient(): SupabaseClientType {
  const url = requireEnv(PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = requireEnv(PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')

  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: typeof window !== 'undefined',
    },
    global: {
      fetch: createTimeoutFetch(15000), // 15 second timeout for all requests
    },
  } as any)

  return client
}

export function getSupabaseClient(): SupabaseClientType {
  if (typeof window === 'undefined') {
    return createSupabaseClient()
  }
  if (!browserClient) {
    browserClient = createSupabaseClient()
  }
  return browserClient
}

export function getSupabaseStorageConfig() {
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'clothing'
  const folder = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_FOLDER || 'uploads'
  return { bucket, folder }
}
