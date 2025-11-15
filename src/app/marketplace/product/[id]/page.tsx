import { notFound } from 'next/navigation'

import { createServiceClient } from '@/lib/supabaseServer'
import { mapVendorProductRow } from '@/lib/vendorProducts'
import ProductDetailView from '@/components/marketplace/ProductDetailView'

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('vendor_products')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .maybeSingle()

    if (error) {
      console.error('[product-detail] Error fetching product:', error)
      notFound()
    }

    if (!data) {
      notFound()
    }

    const product = mapVendorProductRow(data)
    return <ProductDetailView product={product} />
  } catch (error) {
    console.error('[product-detail] Unexpected error:', error)
    notFound()
  }
}

