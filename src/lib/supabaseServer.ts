import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing env: ${name}`)
  }
  return value
}

export function createRouteClient() {
  return createRouteHandlerClient({ cookies })
}

export function createServiceClient(): SupabaseClient {
  const url = requireEnv(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')
  const key = requireEnv(SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const client = createRouteClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  return user?.id ?? null
}
