'use client'

import React, { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import type { VendorRequest } from '@/types/vendor'

const CATEGORY_OPTIONS = [
  "Women's fashion",
  "Men's fashion",
  'Footwear',
  'Accessories',
  'Beauty and wellness',
  'Luxury',
  'Sportswear',
  'Lifestyle',
] as const

interface VendorApplicationFormProps {
  onSubmitted?: (request: VendorRequest) => void
  onCancel?: () => void
}

const PHONE_REGEX = /^[0-9+()\-\s]{6,40}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_DESCRIPTION_LENGTH = 500
const MAX_NOTES_LENGTH = 500

export default function VendorApplicationForm({ onSubmitted, onCancel }: VendorApplicationFormProps) {
  const { toast } = useToast()
  const [businessName, setBusinessName] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [taxId, setTaxId] = useState('')
  const [productCategories, setProductCategories] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // Track which fields have been touched/blurred
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // Validation functions for each field
  const validateBusinessName = (value: string): string | null => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return 'Please enter a business name longer than 2 characters.'
    }
    if (trimmed.length <= 2) {
      return 'Please enter a business name longer than 2 characters.'
    }
    return null
  }

  const validateContactEmail = (value: string): string | null => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return 'Please enter a valid email address.'
    }
    if (!EMAIL_REGEX.test(trimmed.toLowerCase())) {
      return 'Please enter a valid email address.'
    }
    return null
  }

  const validatePhone = (value: string): string | null => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return 'Please enter a valid phone number.'
    }
    if (!PHONE_REGEX.test(trimmed)) {
      return 'Please enter a valid phone number.'
    }
    return null
  }

  const validateTaxId = (value: string): string | null => {
    const trimmed = value.trim()
    // Tax ID is optional, but if provided, must be > 3 characters
    if (trimmed.length > 0 && trimmed.length <= 3) {
      return 'Please enter a registration/tax ID longer than 3 characters.'
    }
    return null
  }

  const validateBusinessAddress = (value: string): string | null => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return 'Please enter an address at least 5 characters long.'
    }
    if (trimmed.length < 5) {
      return 'Please enter an address at least 5 characters long.'
    }
    return null
  }

  const validateBusinessDescription = (value: string): string | null => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return 'Your business description must be at least 21 characters.'
    }
    if (trimmed.length <= 20) {
      return 'Your business description must be at least 21 characters.'
    }
    return null
  }

  // Get error message for a field
  const getFieldError = (fieldName: string): string | null => {
    const shouldShow = touched[fieldName] || submitAttempted
    if (!shouldShow) return null

    switch (fieldName) {
      case 'businessName':
        return validateBusinessName(businessName)
      case 'contactEmail':
        return validateContactEmail(contactEmail)
      case 'phone':
        return validatePhone(phone)
      case 'taxId':
        return validateTaxId(taxId)
      case 'businessAddress':
        return validateBusinessAddress(businessAddress)
      case 'businessDescription':
        return validateBusinessDescription(businessDescription)
      default:
        return null
    }
  }

  const canSubmit = useMemo(() => {
    // Tax ID is optional, so only validate if provided
    const taxIdValid = taxId.trim().length === 0 || validateTaxId(taxId) === null
    
    return (
      validateBusinessName(businessName) === null &&
      validateBusinessDescription(businessDescription) === null &&
      validateBusinessAddress(businessAddress) === null &&
      validateContactEmail(contactEmail) === null &&
      validatePhone(phone) === null &&
      taxIdValid
    )
  }, [businessName, businessDescription, businessAddress, contactEmail, phone, taxId])

  const toggleCategory = (value: string) => {
    setProductCategories((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    )
  }

  const handleBlur = (fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitAttempted(true)
    
    // Mark all fields as touched on submit
    setTouched({
      businessName: true,
      contactEmail: true,
      phone: true,
      taxId: true,
      businessAddress: true,
      businessDescription: true,
    })
    
    if (!canSubmit || submitting) {
      toast({
        title: 'Check your details',
        description: 'Complete the required fields to send your application.',
        variant: 'error',
      })
      return
    }

    let safeWebsite = website.trim()
    if (safeWebsite && !/^https?:\/\//i.test(safeWebsite)) {
      safeWebsite = `https://${safeWebsite}`
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/vendor/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          businessName,
          businessDescription,
          businessAddress,
          contactEmail,
          phone,
          website: safeWebsite,
          taxId,
          productCategories,
          message: notes.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : 'Unable to submit your vendor application right now.',
        )
      }

      const payload = await response.json()
      if (payload?.request) {
        toast({
          title: 'Application submitted',
          description: 'We will review your submission and follow up soon.',
        })
        onSubmitted?.(payload.request as VendorRequest)
        setBusinessName('')
        setBusinessDescription('')
        setBusinessAddress('')
        setContactEmail('')
        setPhone('')
        setWebsite('')
        setTaxId('')
        setProductCategories([])
        setNotes('')
      }
    } catch (error) {
      toast({
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Become a marketplace vendor</CardTitle>
        <CardDescription>
          Share your brand details and we will reach out after the review team approves your storefront.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="vendor-business-name" className="text-sm font-medium text-foreground">
                Business name
              </label>
              <Input
                id="vendor-business-name"
                name="business-name"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                onBlur={() => handleBlur('businessName')}
                placeholder="Echo Shop Boutique"
                autoComplete="organization"
                required
                className={getFieldError('businessName') ? 'border-red-500' : ''}
              />
              {getFieldError('businessName') && (
                <p className="text-sm text-red-600">{getFieldError('businessName')}</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="vendor-contact-email" className="text-sm font-medium text-foreground">
                Contact email
              </label>
              <Input
                id="vendor-contact-email"
                name="contact-email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                onBlur={() => handleBlur('contactEmail')}
                placeholder="hello@yourbrand.com"
                autoComplete="email"
                required
                className={getFieldError('contactEmail') ? 'border-red-500' : ''}
              />
              {getFieldError('contactEmail') && (
                <p className="text-sm text-red-600">{getFieldError('contactEmail')}</p>
              )}
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
                onBlur={() => handleBlur('phone')}
                placeholder="+20 10 1234 5678"
                autoComplete="tel"
                required
                className={getFieldError('phone') ? 'border-red-500' : ''}
              />
              {getFieldError('phone') && (
                <p className="text-sm text-red-600">{getFieldError('phone')}</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="vendor-tax-id" className="text-sm font-medium text-foreground">
                Tax or registration ID <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="vendor-tax-id"
                name="tax-id"
                value={taxId}
                onChange={(event) => setTaxId(event.target.value)}
                onBlur={() => handleBlur('taxId')}
                placeholder="CR-1234567890"
                autoComplete="off"
                className={getFieldError('taxId') ? 'border-red-500' : ''}
              />
              {getFieldError('taxId') && (
                <p className="text-sm text-red-600">{getFieldError('taxId')}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="vendor-website" className="text-sm font-medium text-foreground">
              Website <span className="text-muted-foreground">(optional)</span>
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

          <div className="space-y-2">
            <label htmlFor="vendor-address" className="text-sm font-medium text-foreground">
              Business address
            </label>
            <Textarea
              id="vendor-address"
              name="address"
              value={businessAddress}
              onChange={(event) => setBusinessAddress(event.target.value)}
              onBlur={() => handleBlur('businessAddress')}
              placeholder="Street, city, country"
              rows={3}
              autoComplete="street-address"
              required
              className={getFieldError('businessAddress') ? 'border-red-500' : ''}
            />
            {getFieldError('businessAddress') && (
              <p className="text-sm text-red-600">{getFieldError('businessAddress')}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="vendor-description" className="text-sm font-medium text-foreground">
              Business description
            </label>
            <Textarea
              id="vendor-description"
              name="description"
              value={businessDescription}
              onChange={(event) =>
                setBusinessDescription(event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))
              }
              onBlur={() => handleBlur('businessDescription')}
              rows={5}
              placeholder="Tell us what you sell, your target audience, and how your brand stands out."
              autoComplete="off"
              required
              className={getFieldError('businessDescription') ? 'border-red-500' : ''}
            />
            <div className="flex items-center justify-between">
              {getFieldError('businessDescription') ? (
                <p className="text-sm text-red-600">{getFieldError('businessDescription')}</p>
              ) : (
                <div />
              )}
              <p className="text-xs text-muted-foreground">
                {businessDescription.length}/{MAX_DESCRIPTION_LENGTH}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Product categories</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CATEGORY_OPTIONS.map((category) => {
                const checked = productCategories.includes(category)
                return (
                  <label
                    key={category}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(category)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>{category}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Select all that apply so we can match your storefront to the right shoppers.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="vendor-notes" className="text-sm font-medium text-foreground">
              Anything else we should know? <span className="text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="vendor-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value.slice(0, MAX_NOTES_LENGTH))}
              rows={4}
              placeholder="Share socials, lookbooks, or collaborations you are proud of."
            />
            <p className="text-xs text-muted-foreground text-right">
              {notes.length}/{MAX_NOTES_LENGTH}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? 'Submitting...' : 'Submit application'}
            </Button>
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
            ) : null}
            {!canSubmit ? (
              <p className="text-xs text-muted-foreground">
                Complete the required fields to enable submission.
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
