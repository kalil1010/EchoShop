import { mapVendorProductRow } from '@/lib/vendorProducts'
import { createServiceClient } from '@/lib/supabaseServer'

const PRODUCTS_LIMIT = 48

const formatPrice = (price: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

export const metadata = {
  title: 'Marketplace | ZMODA AI',
  description: 'Discover fresh looks from verified ZMODA vendors and independent creators.',
}

export default async function MarketplacePage() {
  let products: Array<ReturnType<typeof mapVendorProductRow> & { createdAt: string; updatedAt: string }> = []

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

    products = (data ?? []).map((row) => {
      const mapped = mapVendorProductRow(row)
      return {
        ...mapped,
        createdAt: mapped.createdAt.toISOString(),
        updatedAt: mapped.updatedAt.toISOString(),
      }
    })
  } catch (error) {
    console.warn('[marketplace] vendor listings unavailable, falling back to empty state:', error)
    products = []
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-8">
      <section className="space-y-2 text-center md:text-left">
        <h1 className="text-3xl font-semibold text-foreground">Marketplace</h1>
        <p className="text-muted-foreground md:max-w-2xl">
          Browse what independent designers and established brands are listing on ZMODA right now. Fresh drops, local
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
            {products.map((product) => {
              const coverImage = product.gallery[0]?.url ?? product.primaryImageUrl
              const vendorName = product.vendorName ?? 'ZMODA Vendor'

              return (
                <article key={product.id} className="group overflow-hidden rounded-lg border bg-card shadow-sm">
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
                    {coverImage ? (
                      <img
                        src={coverImage}
                        alt={product.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                        Image coming soon
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold text-foreground line-clamp-2">{product.title}</h2>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        {formatPrice(product.price, product.currency)}
                      </span>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-purple-600">{vendorName}</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {product.description ?? product.aiDescription ?? 'No description provided.'}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
