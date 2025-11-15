import { notFound } from 'next/navigation'

import { createServiceClient } from '@/lib/supabaseServer'
import { mapVendorProductRow } from '@/lib/vendorProducts'
import VendorStorefront from '@/components/vendor/VendorStorefront'

export const metadata = {
  title: 'Vendor Shop | Echo Shop',
  description: 'Browse products from this vendor on Echo Shop marketplace.',
}

interface VendorStorefrontPageProps {
  params: Promise<{ vendorId: string }>
}

export default async function VendorStorefrontPage({ params }: VendorStorefrontPageProps) {
  const { vendorId } = await params

  const supabase = createServiceClient()

  // Fetch vendor profile
  const { data: vendorProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, vendor_business_name, vendor_business_description, vendor_website, vendor_contact_email, photo_url')
    .eq('id', vendorId)
    .maybeSingle()

  if (profileError || !vendorProfile) {
    notFound()
  }

  // Fetch vendor's active products
  const { data: productsData, error: productsError } = await supabase
    .from('vendor_products')
    .select(
      `id,
       vendor_id,
       title,
       description,
       price,
       currency,
       status,
       primary_image_url,
       primary_image_path,
       gallery_urls,
       gallery_paths,
       ai_description,
       ai_colors,
       created_at,
       updated_at`,
    )
    .eq('vendor_id', vendorId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  const products = productsError ? [] : (productsData ?? []).map(mapVendorProductRow)

  const vendorName = vendorProfile.vendor_business_name || vendorProfile.display_name || 'Vendor'

  return (
    <VendorStorefront
      vendorId={vendorId}
      vendorName={vendorName}
      vendorDescription={vendorProfile.vendor_business_description || undefined}
      vendorWebsite={vendorProfile.vendor_website || undefined}
      vendorContactEmail={vendorProfile.vendor_contact_email || undefined}
      vendorPhotoUrl={vendorProfile.photo_url || undefined}
      products={products}
    />
  )
}

