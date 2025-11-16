import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { mapSupabaseError, PermissionError } from '@/lib/security'
import { generatePayoutStatementPDF } from '@/lib/pdf/payoutStatement'

export const runtime = 'nodejs'

/**
 * GET /api/vendor/payouts/[id]/statement
 * Generate and download a PDF statement for a payout
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const { id } = await params
    const supabase = createServiceClient()

    // Get payout with transactions
    const { data: payout, error: payoutError } = await supabase
      .from('vendor_payouts')
      .select('*')
      .eq('id', id)
      .eq('vendor_id', userId)
      .maybeSingle()

    if (payoutError || !payout) {
      return NextResponse.json({ error: 'Payout not found.' }, { status: 404 })
    }

    // Get transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('vendor_payout_transactions')
      .select('*')
      .eq('payout_id', id)
      .order('created_at', { ascending: false })

    if (transactionsError) {
      throw transactionsError
    }

    // Get vendor profile for statement
    const { data: vendorProfile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, vendor_business_name, vendor_business_address, vendor_contact_email')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    // Generate PDF
    const pdfBuffer = await generatePayoutStatementPDF({
      payout,
      transactions: transactions || [],
      vendor: {
        name: vendorProfile?.vendor_business_name || vendorProfile?.display_name || 'Vendor',
        address: vendorProfile?.vendor_business_address || '',
        email: vendorProfile?.vendor_contact_email || '',
      },
    })

    // Return PDF as download
    // NextResponse accepts Buffer directly in Node.js runtime
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="payout-${payout.payout_number}.pdf"`,
      },
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to generate statement.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

