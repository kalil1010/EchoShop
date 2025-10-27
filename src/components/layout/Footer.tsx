'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import VendorApplicationForm from '@/components/vendor/VendorApplicationForm'
import { useAuth } from '@/contexts/AuthContext'
import type { VendorRequest } from '@/types/vendor'

const hasActiveRequest = (requests: VendorRequest[]): boolean =>
  requests.some((request) => request.status === 'pending' || request.status === 'approved')

export function Footer() {
  const { user, userProfile, loading } = useAuth()
  const [checkingRequest, setCheckingRequest] = useState(false)
  const [hasVendorRequest, setHasVendorRequest] = useState(false)
  const [showApplication, setShowApplication] = useState(false)
  const normalisedRole = (userProfile?.role ?? user?.role)?.toLowerCase()
  const isOwner = normalisedRole === 'owner'

  useEffect(() => {
    if (isOwner) {
      return
    }
    if (!user || loading) {
      setHasVendorRequest(false)
      setCheckingRequest(false)
      return
    }
    const role = userProfile?.role?.toLowerCase()
    if (role !== 'user') {
      setHasVendorRequest(true)
      setCheckingRequest(false)
      return
    }

    let isMounted = true
    setCheckingRequest(true)

    fetch('/api/vendor/request', { credentials: 'include' })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => {
        if (!isMounted) return
        const requests: VendorRequest[] = Array.isArray(payload?.requests) ? payload.requests : []
        setHasVendorRequest(hasActiveRequest(requests))
      })
      .catch(() => {
        if (!isMounted) return
        setHasVendorRequest(false)
      })
      .finally(() => {
        if (isMounted) {
          setCheckingRequest(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [user, userProfile, loading, isOwner])

  const canApply =
    Boolean(user) &&
    userProfile?.role?.toLowerCase() === 'user' &&
    !checkingRequest &&
    !hasVendorRequest

  const handleApplicationSubmitted = () => {
    setHasVendorRequest(true)
    setShowApplication(false)
  }

  if (isOwner) {
    return null
  }

  return (
    <footer className="border-t bg-white">
      <div className="container mx-auto flex flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-slate-500">
          <p className="font-medium text-slate-700">ZMODA AI</p>
          <p>Empowering stylists and vendors with clever automation.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <Link href="/about" className="hover:text-slate-800">
            About
          </Link>
          <Link href="/marketplace" className="hover:text-slate-800">
            Marketplace
          </Link>
          <Link href="/help" className="hover:text-slate-800">
            Support
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {canApply ? (
            <Button onClick={() => setShowApplication((open) => !open)}>
              {showApplication ? 'Close application' : 'Become a vendor'}
            </Button>
          ) : null}
        </div>
      </div>
      {showApplication ? (
        <div className="border-t bg-slate-50">
          <div className="container mx-auto px-4 py-6">
            <VendorApplicationForm
              onSubmitted={handleApplicationSubmitted}
              onCancel={() => setShowApplication(false)}
            />
          </div>
        </div>
      ) : null}
      <div className="border-t bg-slate-100">
        <div className="container mx-auto flex flex-col gap-2 px-4 py-4 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} ZMODA Labs. All rights reserved.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/privacy" className="hover:text-slate-800">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-800">
              Terms
            </Link>
            <Link href="/vendor/hub" className="hover:text-slate-800">
              Vendor hub
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
