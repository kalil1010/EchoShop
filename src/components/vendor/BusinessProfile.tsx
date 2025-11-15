'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Upload, Image as ImageIcon, Loader2, Instagram, Facebook, Twitter, Globe } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'

const PHONE_REGEX = /^[0-9+()\-\s]{6,40}$/
const WEBSITE_REGEX = /^https?:\/\//i
const URL_REGEX = /^https?:\/\/.+/i

export default function BusinessProfile() {
  const { userProfile, updateUserProfile } = useAuth()
  const { toast } = useToast()
  const [businessName, setBusinessName] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [aboutText, setAboutText] = useState('')
  const [socialInstagram, setSocialInstagram] = useState('')
  const [socialFacebook, setSocialFacebook] = useState('')
  const [socialTwitter, setSocialTwitter] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!userProfile) return
    setBusinessName(userProfile.vendorBusinessName ?? '')
    setBusinessAddress(userProfile.vendorBusinessAddress ?? '')
    setContactEmail(userProfile.vendorContactEmail ?? userProfile.email ?? '')
    setPhone(userProfile.vendorPhone ?? '')
    setWebsite(userProfile.vendorWebsite ?? '')
    setAboutText(userProfile.vendorBusinessDescription ?? '')
    // TODO: Load social handles and logo/banner from profile when fields are added
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

    // Validate social handles
    const socialHandles = {
      instagram: socialInstagram.trim(),
      facebook: socialFacebook.trim(),
      twitter: socialTwitter.trim(),
    }

    for (const [platform, handle] of Object.entries(socialHandles)) {
      if (handle && !URL_REGEX.test(handle) && !handle.startsWith('@')) {
        toast({
          title: `Invalid ${platform} handle`,
          description: `Please provide a valid URL or @username for ${platform}.`,
          variant: 'error',
        })
        return
      }
    }

    setSaving(true)
    try {
      await updateUserProfile({
        vendorBusinessName: businessName.trim(),
        vendorBusinessAddress: businessAddress.trim(),
        vendorContactEmail: contactEmail.trim(),
        vendorPhone: phone.trim(),
        vendorWebsite: cleanedWebsite,
        vendorBusinessDescription: aboutText.trim(),
        // TODO: Add social handles and logo/banner fields when profile schema is updated
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

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please upload an image file.',
        variant: 'error',
      })
      return
    }

    setUploadingLogo(true)
    try {
      // TODO: Implement logo upload to storage
      toast({
        title: 'Logo upload',
        description: 'Logo upload feature coming soon.',
        variant: 'default',
      })
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload logo.',
        variant: 'error',
      })
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) {
        logoInputRef.current.value = ''
      }
    }
  }

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please upload an image file.',
        variant: 'error',
      })
      return
    }

    setUploadingBanner(true)
    try {
      // TODO: Implement banner upload to storage
      toast({
        title: 'Banner upload',
        description: 'Banner upload feature coming soon.',
        variant: 'default',
      })
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload banner.',
        variant: 'error',
      })
    } finally {
      setUploadingBanner(false)
      if (bannerInputRef.current) {
        bannerInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">Business Information</CardTitle>
          <CardDescription>Update your business details and contact information</CardDescription>
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
                placeholder="Echo Shop Boutique"
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
            <label htmlFor="vendor-about" className="text-sm font-medium text-foreground">
              About Your Business
            </label>
            <Textarea
              id="vendor-about"
              value={aboutText}
              onChange={(event) => setAboutText(event.target.value)}
              placeholder="Tell customers about your brand, mission, and what makes you unique..."
              rows={5}
              maxLength={1000}
            />
            <p className="text-xs text-slate-500">{aboutText.length}/1000 characters</p>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save business profile'}
          </Button>
        </form>
      </CardContent>
    </Card>

    {/* Branding Section */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">Branding</CardTitle>
        <CardDescription>Upload logo and banner for your vendor storefront</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Logo</label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="w-full"
            >
              {uploadingLogo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Logo
                </>
              )}
            </Button>
            <p className="text-xs text-slate-500">Recommended: 200x200px, PNG or JPG</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Banner</label>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleBannerUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              className="w-full"
            >
              {uploadingBanner ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Banner
                </>
              )}
            </Button>
            <p className="text-xs text-slate-500">Recommended: 1200x300px, PNG or JPG</p>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Social Media Section */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">Social Media</CardTitle>
        <CardDescription>Connect your social media profiles</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="social-instagram" className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Instagram className="h-4 w-4" />
              Instagram
            </label>
            <Input
              id="social-instagram"
              value={socialInstagram}
              onChange={(event) => setSocialInstagram(event.target.value)}
              placeholder="https://instagram.com/yourbrand or @yourbrand"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="social-facebook" className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Facebook className="h-4 w-4" />
              Facebook
            </label>
            <Input
              id="social-facebook"
              value={socialFacebook}
              onChange={(event) => setSocialFacebook(event.target.value)}
              placeholder="https://facebook.com/yourbrand"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="social-twitter" className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Twitter className="h-4 w-4" />
              Twitter / X
            </label>
            <Input
              id="social-twitter"
              value={socialTwitter}
              onChange={(event) => setSocialTwitter(event.target.value)}
              placeholder="https://twitter.com/yourbrand or @yourbrand"
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save social media links'}
          </Button>
        </form>
      </CardContent>
    </Card>
    </div>
  )
}
