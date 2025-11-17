import { getSupabaseClient } from './supabaseClient'
import type { SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization for supabase client to avoid build-time errors
// This ensures consistent client instance for real-time subscriptions
let _supabase: SupabaseClient | null = null

function initSupabase() {
  if (!_supabase) {
    try {
      _supabase = getSupabaseClient()
    } catch (error) {
      // During build time, env variables might not be available
      // Throw a clearer error that can be caught by components
      if (typeof window === 'undefined') {
        // Server-side/build-time: throw to fail fast
        throw error
      }
      // Client-side: log and rethrow
      console.error('Supabase client initialization failed:', error)
      throw error
    }
  }
  return _supabase
}

// Export supabase as a lazy getter using Proxy
// This allows usage as `supabase.channel()` while deferring initialization
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = initSupabase()
    const value = client[prop as keyof SupabaseClient]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})

