import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)

    // Verify user is admin/owner
    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    // Perform search (same as GET /api/admin/search)
    // Then format as CSV
    const results: Array<{
      type: string
      id: string
      title: string
      description: string
    }> = []

    if (query) {
      // Simplified search - same logic as main search endpoint
      const { data: users } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .or(`email.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(100)

      ;(users || []).forEach((user) => {
        results.push({
          type: 'user',
          id: user.id,
          title: user.display_name || user.email || 'Unknown',
          description: user.email || '',
        })
      })
    }

    // Convert to CSV
    const headers = ['Type', 'ID', 'Title', 'Description']
    const rows = results.map((r) => [
      r.type,
      r.id,
      r.title,
      r.description,
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="search-results-${new Date().toISOString()}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting search results:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export search results' },
      { status: 500 }
    )
  }
}

