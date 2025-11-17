'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'

interface Vendor {
  id: string
  email: string
  vendor_business_name?: string
  display_name?: string
}

interface VendorSelectorProps {
  value: string
  onChange: (vendorId: string) => void
  placeholder?: string
  className?: string
  allowClear?: boolean
}

export function VendorSelector({ value, onChange, placeholder = 'Select a vendor...', className, allowClear = true }: VendorSelectorProps) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchVendors()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const fetchVendors = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users?role=vendor', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load vendors')
      }

      const data = await response.json()
      setVendors(data.users || [])
    } catch (error) {
      console.error('Error fetching vendors:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredVendors = vendors.filter((vendor) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      vendor.email?.toLowerCase().includes(search) ||
      vendor.vendor_business_name?.toLowerCase().includes(search) ||
      vendor.display_name?.toLowerCase().includes(search) ||
      vendor.id.toLowerCase().includes(search)
    )
  })

  const selectedVendor = vendors.find((v) => v.id === value)

  const displayValue = selectedVendor
    ? (selectedVendor.vendor_business_name || selectedVendor.display_name || selectedVendor.email || selectedVendor.id)
    : searchTerm

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setIsOpen(true)
            if (!e.target.value && value) {
              onChange('')
            }
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full"
        />
        {value && allowClear && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
              setSearchTerm('')
              setIsOpen(false)
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isOpen && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <div className="p-3 text-sm text-gray-500">Loading vendors...</div>
          ) : filteredVendors.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No vendors found</div>
          ) : (
            filteredVendors.slice(0, 50).map((vendor) => (
              <button
                key={vendor.id}
                type="button"
                onClick={() => {
                  onChange(vendor.id)
                  setSearchTerm('')
                  setIsOpen(false)
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                  value === vendor.id ? 'bg-purple-50 text-purple-900' : ''
                }`}
              >
                <div className="font-medium">
                  {vendor.vendor_business_name || vendor.display_name || vendor.email || 'Unknown'}
                </div>
                {(vendor.vendor_business_name || vendor.display_name) && (
                  <div className="text-xs text-gray-500">{vendor.email}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

