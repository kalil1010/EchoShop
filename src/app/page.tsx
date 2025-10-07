'use client'

import Link from 'next/link'
import { Sparkles, Shirt, MessageCircle, User, Cloud, Palette, ArrowRight, CheckCircle } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FashionTrendCarousel } from '@/components/home/FashionTrendCarousel'

export default function Home() {
  const { user, userProfile, loading } = useAuth()

  const features = [
    {
      icon: Cloud,
      title: 'Weather-Based Suggestions',
      description: 'Get outfit recommendations tailored to current weather conditions and your location.',
      href: '/outfit',
    },
    {
      icon: Shirt,
      title: 'Digital Closet',
      description: 'Upload photos of your clothes and organize them with automatic color analysis.',
      href: '/closet',
    },
    {
      icon: Palette,
      title: 'Color Analyzer',
      description: 'Analyze garment colors and get matching palettes with AI.',
      href: '/analyzer',
    },
    {
      icon: MessageCircle,
      title: 'ZMODA AI Chat',
      description: 'Chat with ZMODA AI for fashion advice and styling tips.',
      href: '/chat',
    },
    {
      icon: User,
      title: 'Personal Profile',
      description: 'Set your style preferences and get personalized recommendations.',
      href: '/profile',
    },
  ]

  const benefits = [
    'Personalized outfit recommendations',
    'Weather-aware styling',
    'Color coordination assistance',
    'Digital closet organization',
    '24/7 fashion advice',
    'Style preference learning',
  ]

  if (loading) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <div className='space-y-8 animate-pulse'>
          <div className='mx-auto h-12 w-1/2 rounded bg-gray-200' />
          <div className='mx-auto h-6 w-3/4 rounded bg-gray-200' />
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className='h-48 rounded bg-gray-200' />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-12 text-center'>
        <div className='mb-4 flex items-center justify-center'>
          <Sparkles className='mr-2 h-12 w-12 text-purple-600' />
          <h1 className='text-4xl font-bold text-gray-900 md:text-6xl'>ZMODA AI</h1>
        </div>
        <p className='mx-auto mb-8 max-w-3xl text-xl text-gray-600 md:text-2xl'>
          ZMODA AI is your personal fashion assistant powered by AI. Get personalized outfit recommendations, organize your closet,
          and receive expert styling advice.
        </p>

        {!user ? (
          <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-center'>
            <Link href='/auth'>
              <Button size='lg' className='w-full sm:w-auto bg-purple-600 hover:bg-purple-700'>
                Get Started
                <ArrowRight className='ml-2 h-5 w-5' />
              </Button>
            </Link>
            <Link href='/outfit'>
              <Button variant='outline' size='lg' className='w-full sm:w-auto'>
                Try Demo
              </Button>
            </Link>
          </div>
        ) : (
          <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-center'>
            <Link href='/outfit'>
              <Button size='lg' className='w-full sm:w-auto bg-purple-600 hover:bg-purple-700'>
                Get Outfit Suggestion
                <Sparkles className='ml-2 h-5 w-5' />
              </Button>
            </Link>
            <Link href='/closet'>
              <Button variant='outline' size='lg' className='w-full sm:w-auto'>
                View My Closet
                <Shirt className='ml-2 h-5 w-5' />
              </Button>
            </Link>
          </div>
        )}
      </div>

      <section className='mb-12'>
        <div className='mb-6 text-center md:flex md:items-center md:justify-between md:text-left'>
          <div>
            <h2 className='text-3xl font-bold text-gray-900'>Nearby New Arrivals</h2>
            <p className='text-sm text-gray-500'>
              Fresh drops from Egyptian boutiques within 5 km of your current spot.
            </p>
          </div>
        </div>
        <FashionTrendCarousel gender={userProfile?.gender ?? undefined} age={userProfile?.age ?? undefined} />
      </section>

      <div className='mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
        {features.map((feature, index) => (
          <Link
            key={index}
            href={feature.href}
            className='block h-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500'
          >
            <Card className='h-full cursor-pointer transition-shadow hover:shadow-lg'>
              <CardHeader>
                <feature.icon className='mb-2 h-8 w-8 text-purple-600' />
                <CardTitle className='text-lg'>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className='mb-12 rounded-lg bg-gray-50 p-6 sm:p-8'>
        <h2 className='mb-8 text-center text-3xl font-bold'>Why Choose ZMODA AI?</h2>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {benefits.map((benefit, index) => (
            <div key={index} className='flex items-center space-x-3'>
              <CheckCircle className='h-5 w-5 flex-shrink-0 text-green-500' />
              <span className='text-gray-700'>{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      {!user && (
        <div className='space-y-4 rounded-lg bg-purple-600 p-6 text-center text-white sm:p-8'>
          <h2 className='mb-4 text-3xl font-bold'>Ready to Transform Your Style?</h2>
          <p className='mb-6 text-xl opacity-90'>
            Join thousands of users who have discovered their perfect style with ZMODA AI.
          </p>
          <Link href='/auth'>
            <Button size='lg' variant='secondary'>
              Start Your Style Journey
              <ArrowRight className='ml-2 h-5 w-5' />
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}


