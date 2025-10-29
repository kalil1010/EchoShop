import { describe, expect, it } from 'vitest'

import {
  getPortalAccess,
  getRoleMeta,
  getDefaultRouteForRole,
  resolvePortalFromPath,
} from '@/lib/roles'

describe('portal access rules', () => {
  it('denies owners on the vendor portal with owner guidance', () => {
    const result = getPortalAccess('owner', 'vendor')

    expect(result.allowed).toBe(false)
    expect(result.denial?.requiresLogout).toBe(true)
    expect(result.denial?.banner?.title).toMatch(/owner account detected/i)
    expect(result.denial?.banner?.actionHref).toBe('/downtown')
    expect(result.denial?.toast?.variant).toBe('error')
  })

  it('suggests upgrade path for customers on the vendor portal', () => {
    const result = getPortalAccess('user', 'vendor')

    expect(result.allowed).toBe(false)
    expect(result.denial?.requiresLogout).toBe(true)
    expect(result.denial?.banner?.title).toMatch(/request vendor upgrade/i)
    expect(result.denial?.banner?.actionHref).toBe('/vendor/hub')
    expect(result.denial?.toast?.variant).toBe('warning')
  })

  it('routes each role to its default dashboard', () => {
    expect(getDefaultRouteForRole('owner')).toBe('/downtown/dashboard')
    expect(getDefaultRouteForRole('vendor')).toBe('/atlas')
    expect(getDefaultRouteForRole('user')).toBe('/')
  })

  it('resolves portal targets from request paths', () => {
    expect(resolvePortalFromPath('/downtown/settings')).toBe('owner')
    expect(resolvePortalFromPath('/atlas/products')).toBe('vendor')
    expect(resolvePortalFromPath('/auth')).toBe('customer')
  })

  it('provides welcoming copy per role', () => {
    const vendorMeta = getRoleMeta('vendor')
    expect(vendorMeta.welcomeTitle).toMatch(/vendor/i)
    expect(vendorMeta.welcomeSubtitle).toMatch(/marketplace/i)

    const ownerMeta = getRoleMeta('owner')
    expect(ownerMeta.welcomeTitle).toMatch(/owner/i)
    expect(ownerMeta.welcomeSubtitle).toMatch(/marketplace/i)
  })
})

