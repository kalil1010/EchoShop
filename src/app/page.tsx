'use client'

import Link from 'next/link'
import type { ComponentType } from 'react'
import { Sparkles, Shirt, MessageCircle, User, Cloud, Palette, ArrowRight, CheckCircle } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { FashionTrendCarousel } from '@/components/home/FashionTrendCarousel'
import { FeatureCard } from '@/components/ui/FeatureCard'
import { HowItWorksSection } from '@/components/home/HowItWorksSection'
import { HelpSection } from '@/components/home/HelpSection'
import { ReactionBar } from '@/components/ui/ReactionBar'

const primaryFeatures: Array<{
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  href: string
  cta: string
  accent: 'primary' | 'secondary' | 'neutral'
  tourId: string
}> = [
  {
    icon: Sparkles,
    title: 'Outfit Builder',
    description: 'Generate smart looks that blend your closet with pro styling cues.',
    href: '/outfit',
    cta: 'Try Outfit Builder',
    accent: 'primary',
    tourId: 'hero-feature-outfit',
  },
  {
    icon: Shirt,
    title: 'Digital Closet',
    description: 'Photograph your pieces and instantly catalogue colors, notes, and palettes.',
    href: '/closet',
    cta: 'View My Closet',
    accent: 'secondary',
    tourId: 'hero-feature-closet',
  },
  {
    icon: Palette,
    title: 'Color Analyzer',
    description: 'Drop in a photo and discover matching tones, accessories, and outfit pairings.',
    href: '/analyzer',
    cta: 'Analyze Colors',
    accent: 'neutral',
    tourId: 'hero-feature-analyzer',
  },
  {
    icon: MessageCircle,
    title: 'ZMODA AI Assistant',
    description: 'Ask questions, get styling tips, or take the guided tour any time.',
    href: '/chat',
    cta: 'Start Chatting',
    accent: 'neutral',
    tourId: 'hero-feature-chat',
  },
]

const secondaryFeatures: Array<{
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  href: string
  cta: string
}> = [
  {
    icon: Cloud,
    title: 'Weather-Based Suggestions',
    description: 'Plan outfits that respect the forecast without sacrificing style.',
    href: '/outfit?view=weather',
    cta: 'See weather outfits',
  },
  {
    icon: User,
    title: 'Personal Profile',
    description: 'Set your style mood, sizing, and favourite palettes to personalise every result.',
    href: '/profile',
    cta: 'Update profile',
  },
]

const benefits = [
  'Personalised outfit recommendations',
  'Weather-aware styling',
  'Color coordination assistance',
  'Digital closet organisation',
  '24/7 fashion advice',
  'Style preference learning',
]

export default function Home() {
  const { user, userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className='container mx-auto px-4 py-16'>
        <div className='space-y-8 animate-pulse'>
          <div className='mx-auto h-12 w-1/2 rounded bg-slate-200' />
          <div className='mx-auto h-6 w-3/4 rounded bg-slate-200' />
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className='h-48 rounded-2xl bg-slate-200' />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='container mx-auto px-4 py-12'>
      <section className='grid gap-12 lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)] lg:items-center'>
        <div>
          <span className='inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-600'>
            <Sparkles className='h-3 w-3' /> New onboarding experience
          </span>
          <h1 className='mt-4 text-4xl font-bold text-slate-900 md:text-5xl'>Style smarter with ZMODA AI.</h1>
          <p className='mt-4 max-w-xl text-base text-slate-600'>Discover outfits you love, organise your wardrobe, and master colour theory—all guided by an assistant that learns your vibe.</p>
          <div className='mt-6 flex flex-wrap items-center gap-3'>
            {!user ? (
              <>
                <Link href='/auth'>
                  <Button size='lg' className='bg-purple-600 hover:bg-purple-700'>
                    Get Started
                    <ArrowRight className='ml-2 h-5 w-5' />
                  </Button>
                </Link>
                <Button size='lg' variant='ghost' className='text-purple-600 hover:bg-purple-50' onClick={() => window.scrollTo({ top: 800, behavior: 'smooth' })}>
                  Watch quick tour
                </Button>
              </>
            ) : (
              <>
                <Link href='/outfit'>
                  <Button size='lg' className='bg-purple-600 hover:bg-purple-700'>
                    Launch Outfit Builder
                    <ArrowRight className='ml-2 h-5 w-5' />
                  </Button>
                </Link>
                <Link href='/closet'>
                  <Button size='lg' variant='outline'>
                    Add to My Closet
                  </Button>
                </Link>
              </>
            )}
          </div>
          <p className='mt-6 text-xs uppercase tracking-[0.2em] text-slate-400'>Trusted by 12,000+ creators and stylists</p>
          <ReactionBar featureSlug='homepage_hero' className='mt-6' />
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          {primaryFeatures.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              href={feature.href}
              cta={feature.cta}
              accent={feature.accent}
              dataTour={feature.tourId}
            />
          ))}
        </div>
      </section>

      <HowItWorksSection />
      <ReactionBar featureSlug='homepage_how_it_works' className='mt-6' />

      <section className='mt-16 space-y-8'>
        <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
          <div>
            <h2 className='text-2xl font-bold text-slate-900 md:text-3xl'>Nearby New Arrivals</h2>
            <p className='text-sm text-slate-500'>Fresh drops from Egyptian boutiques within 5 km of your current spot.</p>
          </div>
          <Link href='/outfit?view=arrivals' className='text-sm font-semibold text-purple-600 hover:text-purple-700'>See collection ?</Link>
        </div>
        <FashionTrendCarousel gender={userProfile?.gender ?? undefined} age={userProfile?.age ?? undefined} />
      </section>

      <section className='mt-16 grid gap-6 md:grid-cols-2'>
        {secondaryFeatures.map((feature) => (
          <FeatureCard
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            href={feature.href}
            cta={feature.cta}
            accent='neutral'
          />
        ))}
      </section>

      <section className='mt-16 rounded-3xl bg-slate-900 px-6 py-12 text-white shadow-lg sm:px-12'>
        <h2 className='text-3xl font-bold'>Why choose ZMODA AI?</h2>
        <p className='mt-2 max-w-2xl text-sm text-slate-200'>Stylists, colour experts, and a smart assistant work together so you never run out of outfit ideas.</p>
        <div className='mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {benefits.map((benefit) => (
            <div key={benefit} className='flex items-center space-x-3 rounded-2xl border border-white/10 bg-white/5 p-4'>
              <CheckCircle className='h-5 w-5 text-purple-300' />
              <span className='text-sm'>{benefit}</span>
            </div>
          ))}
        </div>
      </section>
      <HelpSection />
      {!user && (
        <section className='mt-16 space-y-4 rounded-3xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-purple-700 p-10 text-center text-white shadow-lg'>
          <h2 className='text-3xl font-bold'>Ready to transform your style?</h2>
          <p className='text-lg text-white/80'>Join thousands of users who have already upgraded their daily looks with ZMODA.</p>
          <div className='flex flex-wrap justify-center gap-3'>
            <Link href='/auth'>
              <Button size='lg' variant='secondary'>
                Start your style journey
                <ArrowRight className='ml-2 h-5 w-5' />
              </Button>
            </Link>
            <Link href='/outfit'>
              <Button size='lg' className='bg-white text-purple-600 hover:bg-purple-100'>
                Try demo first
              </Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}

