import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type SupabaseClientType = SupabaseClient

let browserClient: SupabaseClientType | null = null

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function createSupabaseClient(): SupabaseClientType {
  const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: typeof window !== 'undefined',
    },
  })
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

export function getSupabaseServiceRoleClient(): SupabaseClientType {
  const url = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function getSupabaseStorageConfig() {
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'clothing'
  const folder = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_FOLDER || 'uploads'
  return { bucket, folder }
}
