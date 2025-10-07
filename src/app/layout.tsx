import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../styles/globals.css'
import 'react-image-crop/dist/ReactCrop.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { Navigation } from '@/components/layout/Navigation'
import { ToastProvider } from '@/components/ui/toast'
import { OnboardingProvider } from '@/components/onboarding/OnboardingProvider'
import { FloatingAssistant } from '@/components/chat/FloatingAssistant'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ZMODA AI - Your Personal Fashion Assistant',
  description: 'Get personalized outfit recommendations based on weather, occasion, and your personal style preferences.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <ToastProvider>
            <AuthProvider>
              <OnboardingProvider>
                <Navigation />
                <main className="pb-8">
                  {children}
                </main>
                <FloatingAssistant />
              </OnboardingProvider>
            </AuthProvider>
          </ToastProvider>
        </div>
      </body>
    </html>
  )
}
