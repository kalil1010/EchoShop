'use client'

import React from 'react'

import UserManagement from './UserManagement'

export default function VendorManagement() {
  return (
    <UserManagement
      heading="Vendor management"
      description="Review marketplace vendors and suspend access when needed."
      roleFilter="vendor"
      emptyStateMessage="No vendors are active yet."
    />
  )
}
