'use client'

import React, { useState, Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'
import { SignUpForm } from '@/components/auth/SignUpForm'

function AuthContent() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const toggleMode = () => setMode((m) => (m === 'login' ? 'signup' : 'login'))

  return (
    <div className="container mx-auto px-4 py-8">
      {mode === 'login' ? (
        <LoginForm onToggleMode={toggleMode} />
      ) : (
        <SignUpForm onToggleMode={toggleMode} />
      )}
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto" />
          <div className="h-96 bg-gray-200 rounded max-w-md mx-auto" />
        </div>
      </div>
    }>
      <AuthContent />
    </Suspense>
  )
}
