import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError } from '@/lib/security'
import { mapVendorRequestRow } from '@/lib/vendorRequests'
import type { VendorRequest } from '@/types/vendor'
import { normaliseRole } from '@/lib/roles'

export const runtime = 'nodejs'

type RequestRow = {
  id: string
  user_id: string
  status: string
  message: string | null
  admin_notes: string | null
  decided_at: string | null
  business_name: string | null
  business_description: string | null
  business_address: string | null
  product_categories: string[] | null
  contact_email: string | null
  phone: string | null
  website: string | null
  tax_id: string | null
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  created_at: string | null
  updated_at: string | null
}

const MAX_PENDING_REQUESTS = 3

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const [{ data: profileRow }, { data: requestRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle<{ role: string | null }>(),
      supabase
        .from('vendor_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_PENDING_REQUESTS),
    ])

    const requests: VendorRequest[] = (requestRows ?? []).map(mapVendorRequestRow)

    return NextResponse.json({
      role: normaliseRole(profileRow?.role),
      requests,
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Failed to load vendor request status.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

const MAX_NAME_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 500
const MAX_MESSAGE_LENGTH = 500
const MAX_ADDRESS_LENGTH = 240
const MAX_PHONE_LENGTH = 40
const MAX_TAX_ID_LENGTH = 64
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^[0-9+()\-\s]{6,40}$/

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const truncate = (value: string, max: number): string =>
  value.length > max ? value.slice(0, max) : value

type VendorRequestPayload = {
  businessName?: string
  businessDescription?: string
  businessAddress?: string
  contactEmail?: string
  phone?: string
  website?: string
  taxId?: string
  productCategories?: unknown
  message?: string
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const [{ data: profileRow }, { data: existingRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle<{ role: string | null }>(),
      supabase
        .from('vendor_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    const currentRole = normaliseRole(profileRow?.role)
    if (currentRole !== 'user') {
      return NextResponse.json(
        { error: 'This account already has vendor access.' },
        { status: 400 },
      )
    }

    if (existingRows && existingRows.length > 0) {
      const latest = mapVendorRequestRow(existingRows[0] as RequestRow)
      if (latest.status === 'pending') {
        return NextResponse.json(
          { error: 'A vendor application is already pending review.' },
          { status: 400 },
        )
      }
    }

    const payload = (await request.json().catch(() => ({}))) as VendorRequestPayload

    const businessName = truncate(trimString(payload.businessName), MAX_NAME_LENGTH)
    if (!businessName) {
      return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
    }

    const businessDescription = truncate(
      trimString(payload.businessDescription),
      MAX_DESCRIPTION_LENGTH,
    )
    if (!businessDescription) {
      return NextResponse.json({ error: 'Business description is required.' }, { status: 400 })
    }

    const businessAddress = truncate(
      trimString(payload.businessAddress),
      MAX_ADDRESS_LENGTH,
    )
    if (!businessAddress) {
      return NextResponse.json({ error: 'Business address is required.' }, { status: 400 })
    }

    const contactEmailRaw = truncate(trimString(payload.contactEmail), 255)
    if (!contactEmailRaw || !EMAIL_REGEX.test(contactEmailRaw.toLowerCase())) {
      return NextResponse.json({ error: 'A valid contact email address is required.' }, { status: 400 })
    }

    const phoneRaw = truncate(trimString(payload.phone), MAX_PHONE_LENGTH)
    if (!phoneRaw || !PHONE_REGEX.test(phoneRaw)) {
      return NextResponse.json({ error: 'A valid business phone number is required.' }, { status: 400 })
    }

    const websiteInput = truncate(trimString(payload.website), 255)
    let website: string | null = null
    if (websiteInput) {
      let urlCandidate = websiteInput
      if (!/^https?:\/\//i.test(urlCandidate)) {
        urlCandidate = `https://${urlCandidate}`
      }
      try {
        const parsed = new URL(urlCandidate)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Unsupported protocol')
        }
        website = truncate(parsed.toString(), 255)
      } catch {
        return NextResponse.json({ error: 'Website URL must be a valid HTTP(S) address.' }, { status: 400 })
      }
    }

    const taxIdRaw = truncate(trimString(payload.taxId), MAX_TAX_ID_LENGTH)
    // Tax ID is optional, but if provided, must be > 3 characters
    const taxId = taxIdRaw && taxIdRaw.length > 3 ? taxIdRaw : null
    if (taxIdRaw && taxIdRaw.length > 0 && taxIdRaw.length <= 3) {
      return NextResponse.json({ error: 'Tax or business registration ID must be longer than 3 characters if provided.' }, { status: 400 })
    }

    const productCategories = Array.isArray(payload.productCategories)
      ? payload.productCategories
          .map((value) => truncate(trimString(value), 64))
          .filter((value) => value.length > 0)
      : []

    const message = truncate(trimString(payload.message), MAX_MESSAGE_LENGTH)
    const nowIso = new Date().toISOString()

    const { data, error } = await supabase
      .from('vendor_requests')
      .insert({
        user_id: userId,
        status: 'pending',
        message: message || null,
        business_name: businessName,
        business_description: businessDescription,
        business_address: businessAddress,
        contact_email: contactEmailRaw,
        phone: phoneRaw,
        website,
        tax_id: taxId,
        product_categories: productCategories.length > 0 ? productCategories : null,
        submitted_at: nowIso,
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
      })
      .select('*')
      .single<RequestRow>()

    if (error) {
      throw error
    }

    return NextResponse.json({ request: mapVendorRequestRow(data) }, { status: 201 })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to submit vendor request.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
