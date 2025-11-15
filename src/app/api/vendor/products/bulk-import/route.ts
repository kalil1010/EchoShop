import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { mapSupabaseError, PermissionError, sanitizeText } from '@/lib/security'

export const runtime = 'nodejs'

// Placeholder for bulk import - this will need CSV/Excel parsing implementation
export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    // TODO: Implement CSV/Excel parsing
    // For now, return placeholder response
    return NextResponse.json({
      imported: 0,
      errors: [],
      message: 'Bulk import feature coming soon. Please use the individual product upload for now.',
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to import products.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

