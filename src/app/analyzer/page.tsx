'use client'

import { ColorAnalyzer } from '@/components/analyzer/ColorAnalyzer'
import { ReactionBar } from '@/components/ui/ReactionBar'

export default function AnalyzerPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr),320px]">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Color Analyzer</h1>
            <p className="text-slate-600">Discover palettes, complementary tones, and ready-to-wear matches from any photo.</p>
          </div>
          <ColorAnalyzer />
        </div>
        <aside className="flex h-fit flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Tips</p>
          <h2 className="text-lg font-semibold text-slate-900">Get sharper color matches</h2>
          <ul className="space-y-3 text-sm text-slate-600">
            <li>Use natural lighting and fill most of the frame with the garment.</li>
            <li>Adjust the crop to focus on the main color block before running analysis.</li>
            <li>Save palettes you like so the Outfit Builder can recommend matching pieces.</li>
          </ul>
          <ReactionBar featureSlug="analyzer_page" />
        </aside>
      </div>
    </div>
  )
}


