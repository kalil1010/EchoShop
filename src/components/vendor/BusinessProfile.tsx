'use client'

import React, { useEffect, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'

const PHONE_REGEX = /^[0-9+()\-\s]{6,40}$/
const WEBSITE_REGEX = /^https?:\/\//i

export default function BusinessProfile() {
  const { userProfile, updateUserProfile } = useAuth()
  const { toast } = useToast()
  const [businessName, setBusinessName] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userProfile) return
    setBusinessName(userProfile.vendorBusinessName ?? '')
    setBusinessDescription(userProfile.vendorBusinessDescription ?? '')
    setBusinessAddress(userProfile.vendorBusinessAddress ?? '')
    setContactEmail(userProfile.vendorContactEmail ?? userProfile.email ?? '')
    setPhone(userProfile.vendorPhone ?? '')
    setWebsite(userProfile.vendorWebsite ?? '')
  }, [userProfile])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userProfile || saving) return

    if (!businessName.trim()) {
      toast({
        title: 'Business name required',
        description: 'Please provide a business name before saving.',
        variant: 'error',
      })
      return
    }
    if (!businessDescription.trim()) {
      toast({
        title: 'Business description required',
        description: 'Share a short description so customers know what you offer.',
        variant: 'error',
      })
      return
    }
    if (!contactEmail.trim()) {
      toast({
        title: 'Contact email required',
        description: 'Customers need a contact email for inquiries.',
        variant: 'error',
      })
      return
    }
    if (phone && !PHONE_REGEX.test(phone)) {
      toast({
        title: 'Invalid phone number',
        description: 'Use digits and + ( ) - characters only.',
        variant: 'error',
      })
      return
    }

    let cleanedWebsite = website.trim()
    if (cleanedWebsite && !WEBSITE_REGEX.test(cleanedWebsite)) {
      cleanedWebsite = `https://${cleanedWebsite}`
    }

    setSaving(true)
    try {
      await updateUserProfile({
        vendorBusinessName: businessName.trim(),
        vendorBusinessDescription: businessDescription.trim(),
        vendorBusinessAddress: businessAddress.trim(),
        vendorContactEmail: contactEmail.trim(),
        vendorPhone: phone.trim(),
        vendorWebsite: cleanedWebsite,
      })
      toast({
        title: 'Business profile saved',
        description: 'Your vendor profile is now up to date.',
      })
    } catch (error) {
      toast({
        title: 'Failed to save changes',
        description: error instanceof Error ? error.message : 'Please try again shortly.',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">
          Business profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="vendor-business-name" className="text-sm font-medium text-foreground">
                Business name
              </label>
              <Input
                id="vendor-business-name"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="ZMODA Boutique"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="vendor-contact-email" className="text-sm font-medium text-foreground">
                Contact email
              </label>
              <Input
                id="vendor-contact-email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="hello@yourbrand.com"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="vendor-phone" className="text-sm font-medium text-foreground">
                Business phone
              </label>
              <Input
                id="vendor-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+20 101 234 5678"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="vendor-website" className="text-sm font-medium text-foreground">
                Website
              </label>
              <Input
                id="vendor-website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://yourbrand.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="vendor-address" className="text-sm font-medium text-foreground">
              Business address
            </label>
            <Textarea
              id="vendor-address"
              value={businessAddress}
              onChange={(event) => setBusinessAddress(event.target.value)}
              placeholder="Street, City, Country"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="vendor-description" className="text-sm font-medium text-foreground">
              Business description
            </label>
            <Textarea
              id="vendor-description"
              value={businessDescription}
              onChange={(event) => setBusinessDescription(event.target.value.slice(0, 500))}
              placeholder="Tell shoppers what makes your collections unique."
              rows={5}
            />
            <p className="text-xs text-slate-500">
              {businessDescription.length}/500 characters
            </p>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save business profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
