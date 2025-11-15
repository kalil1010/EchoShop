import { mapVendorProductRow } from '@/lib/vendorProducts'
import { createServiceClient } from '@/lib/supabaseServer'
import ProductCard from '@/components/marketplace/ProductCard'

const PRODUCTS_LIMIT = 48

export const metadata = {
  title: 'Marketplace | Echo Shop',
  description: 'Discover fresh looks from verified Echo Shop vendors and independent creators.',
}

export default async function MarketplacePage() {
  let products: ReturnType<typeof mapVendorProductRow>[] = []

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
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
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(PRODUCTS_LIMIT)

    if (error) {
      throw error
    }

    products = (data ?? []).map(mapVendorProductRow)
  } catch (error) {
    console.warn('[marketplace] vendor listings unavailable, falling back to empty state:', error)
    products = []
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <section className="space-y-2 text-center md:text-left">
        <h1 className="text-3xl font-semibold text-foreground">Marketplace</h1>
        <p className="text-muted-foreground md:max-w-2xl">
          Browse what independent designers and established brands are listing on Echo Shop right now. Fresh drops, local
          talent, and AI-curated standouts updated daily.
        </p>
      </section>

      <section>
        {products.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            <p className="text-lg font-medium text-foreground">Nothing to show yet</p>
            <p className="mt-1 text-sm">
              Our vendors are getting ready to share their next collections. Check back soon for new arrivals.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}




