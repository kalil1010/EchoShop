'use client'

import React from 'react'

import VendorDashboard from './VendorDashboard'
import type { VendorProduct } from '@/types/vendor'

interface ProductManagementProps {
  products: VendorProduct[]
  vendorName: string
}

export default function ProductManagement({ products, vendorName }: ProductManagementProps) {
  return <VendorDashboard initialProducts={products} vendorName={vendorName} />
}
