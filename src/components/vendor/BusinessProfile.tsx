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
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
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
    setLogoUrl(userProfile.vendorLogoUrl ?? null)
    setBannerUrl(userProfile.vendorBannerUrl ?? null)
    // TODO: Load social handles from profile when fields are added
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

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Logo must be 5MB or smaller.',
        variant: 'error',
      })
      return
    }

    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'logo')

      const response = await fetch('/api/vendor/branding/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload logo')
      }

      const data = await response.json()
      setLogoUrl(data.url)
      
      // Refresh profile to get updated data
      if (updateUserProfile) {
        await updateUserProfile({ vendorLogoUrl: data.url })
      }

      toast({
        title: 'Logo uploaded',
        description: 'Your logo has been uploaded successfully.',
        variant: 'success',
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

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Banner must be 5MB or smaller.',
        variant: 'error',
      })
      return
    }

    setUploadingBanner(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'banner')

      const response = await fetch('/api/vendor/branding/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload banner')
      }

      const data = await response.json()
      setBannerUrl(data.url)
      
      // Refresh profile to get updated data
      if (updateUserProfile) {
        await updateUserProfile({ vendorBannerUrl: data.url })
      }

      toast({
        title: 'Banner uploaded',
        description: 'Your banner has been uploaded successfully.',
        variant: 'success',
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
                name="businessName"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Echo Shop Boutique"
                autoComplete="organization"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="vendor-contact-email" className="text-sm font-medium text-foreground">
                Contact email
              </label>
              <Input
                id="vendor-contact-email"
                name="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="hello@yourbrand.com"
                autoComplete="email"
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
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+20 101 234 5678"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="vendor-website" className="text-sm font-medium text-foreground">
                Website
              </label>
              <Input
                id="vendor-website"
                name="website"
                type="url"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://yourbrand.com"
                autoComplete="url"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="vendor-address" className="text-sm font-medium text-foreground">
              Business address
            </label>
            <Textarea
              id="vendor-address"
              name="businessAddress"
              value={businessAddress}
              onChange={(event) => setBusinessAddress(event.target.value)}
              placeholder="Street, City, Country"
              rows={3}
              autoComplete="street-address"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="vendor-about" className="text-sm font-medium text-foreground">
              About Your Business
            </label>
            <Textarea
              id="vendor-about"
              name="aboutText"
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
            {logoUrl && (
              <div className="mb-2 rounded-lg border p-2">
                <img
                  src={logoUrl}
                  alt="Vendor logo"
                  className="h-20 w-20 rounded object-cover"
                />
              </div>
            )}
            <input
              ref={logoInputRef}
              id="logo-upload"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
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
                  {logoUrl ? 'Replace Logo' : 'Upload Logo'}
                </>
              )}
            </Button>
            <p className="text-xs text-slate-500">Recommended: 200x200px, PNG or JPG (max 5MB)</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Banner</label>
            {bannerUrl && (
              <div className="mb-2 rounded-lg border overflow-hidden">
                <img
                  src={bannerUrl}
                  alt="Vendor banner"
                  className="h-32 w-full object-cover"
                />
              </div>
            )}
            <input
              ref={bannerInputRef}
              id="banner-upload"
              name="banner"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
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
                  {bannerUrl ? 'Replace Banner' : 'Upload Banner'}
                </>
              )}
            </Button>
            <p className="text-xs text-slate-500">Recommended: 1200x300px, PNG or JPG (max 5MB)</p>
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
              name="socialInstagram"
              type="url"
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
              name="socialFacebook"
              type="url"
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
              name="socialTwitter"
              type="url"
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
