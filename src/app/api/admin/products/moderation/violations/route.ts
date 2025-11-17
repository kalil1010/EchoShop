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

    // Get products with violations
    const { data: products, error } = await supabase
      .from('vendor_products')
      .select(`
        id,
        vendor_id,
        title,
        moderation_reasons,
        profiles:vendor_id (
          email,
          vendor_business_name
        )
      `)
      .not('moderation_reasons', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) throw error

    // Format violations
    const violations = (products || [])
      .filter((p: any) => p.moderation_reasons && Array.isArray(p.moderation_reasons))
      .flatMap((product: any) =>
        (product.moderation_reasons || []).map((reason: string, index: number) => ({
          id: `${product.id}-${index}`,
          vendor_id: product.vendor_id,
          product_id: product.id,
          violation_type: 'product_moderation',
          violation_reason: reason,
          severity: 'medium' as const,
          created_at: product.updated_at,
          vendor_name: product.profiles?.vendor_business_name,
          product_title: product.title,
        }))
      )

    return NextResponse.json({ violations })
  } catch (error) {
    console.error('Error fetching violations:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch violations' },
      { status: 500 }
    )
  }
}

