import { NextResponse } from 'next/server'

import { createRouteClient, createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError, requireRole } from '@/lib/security'

export const runtime = 'nodejs'

type RecentItem = {
  id: string
  label: string | null
  created_at: string | null
  role?: string | null
  status?: string | null
}

const normaliseRole = (value: string | null | undefined): string =>
  (value ?? 'user').toLowerCase()

const toIso = (value: string | null | undefined): string | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function GET() {
  try {
    // Use route client for authentication (has access to user session)
    const routeClient = createRouteClient()
    await requireRole(routeClient, 'owner')
    
    // Use service client for queries (bypasses RLS for owner operations)
      const supabase = createServiceClient()
