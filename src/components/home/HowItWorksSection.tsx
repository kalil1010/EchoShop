'use client'

import { ClipboardList, Image as ImageIcon, Sparkles, Wand2 } from 'lucide-react'

const STEPS = [
  {
    icon: ClipboardList,
    title: 'Tell us your vibe',
    description: 'Set style goals, favorite colors, and occasions in under a minute.',
  },
  {
    icon: ImageIcon,
    title: 'Upload or sync closet items',
    description: 'Snap a photo or import from your camera roll—ZMODA extracts colors instantly.',
  },
  {
    icon: Wand2,
    title: 'Get smart outfit plans',
    description: 'Generate AI-styled looks, tweak them live, and save palettes for later.',
  },
]

export function HowItWorksSection() {
  return (
    <section className='mt-16 rounded-3xl border border-slate-100 bg-white/90 p-8 shadow-sm backdrop-blur'>
      <h2 className='text-2xl font-bold text-slate-900 md:text-3xl'>How ZMODA Works — in 3 Simple Steps</h2>
      <p className='mt-2 max-w-2xl text-sm text-slate-600'>From organizing your closet to styling outfits, the experience is designed to be quick, visual, and fun.</p>
      <div className='mt-8 grid gap-6 md:grid-cols-3'>
        {STEPS.map((step) => (
          <div key={step.title} className='flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-6 shadow-inner shadow-white/60'>
            <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white shadow-lg'>
              <step.icon className='h-6 w-6' />
            </div>
            <div>
              <h3 className='text-lg font-semibold text-slate-900'>{step.title}</h3>
              <p className='mt-2 text-sm text-slate-600'>{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
