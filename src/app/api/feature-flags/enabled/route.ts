import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendor_id')

    const supabase = createServiceClient()

    // Call database function to get all enabled features
    const { data, error } = await supabase.rpc('get_enabled_features', {
      p_vendor_id: vendorId || null,
    })

    if (error) throw error

    return NextResponse.json({ features: data || [] })
  } catch (error) {
    console.error('Error fetching enabled features:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch enabled features' },
      { status: 500 }
    )
  }
}

