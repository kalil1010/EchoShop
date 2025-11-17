import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const flagKey = searchParams.get('flag_key')
    const vendorId = searchParams.get('vendor_id')

    if (!flagKey) {
      return NextResponse.json(
        { error: 'Flag key is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Call database function to check if feature is enabled
    const { data, error } = await supabase.rpc('is_feature_enabled', {
      p_flag_key: flagKey,
      p_vendor_id: vendorId || null,
    })

    if (error) throw error

    return NextResponse.json({ enabled: data === true })
  } catch (error) {
    console.error('Error checking feature flag:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check feature flag' },
      { status: 500 }
    )
  }
}

