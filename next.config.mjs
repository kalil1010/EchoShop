/**
 * Next.js configuration with basic security headers applied to all routes.
 * CSP allows Supabase resources.
 */

// Get Supabase URL for CSP and image configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : 'supabase.co'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Content Security Policy: Allow Supabase and necessary resources
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: Allow Next.js and inline scripts
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: Allow inline styles
      "style-src 'self' 'unsafe-inline'",
      // Images: Allow all HTTPS images
      "img-src 'self' data: https: blob:",
      // Fonts: Allow self and data URIs
      "font-src 'self' data: https:",
      // Connect: Allow Supabase
      "connect-src 'self' https://*.supabase.co https://*.supabase.in",
      // Frames: Allow self
      "frame-src 'self'",
      // Workers: Allow blob workers
      "worker-src 'self' blob:",
      // Objects: Block all objects
      "object-src 'none'",
      // Base URI: Restrict to self
      "base-uri 'self'",
      // Form actions: Allow self and Supabase
      "form-action 'self' https://*.supabase.co",
      // Frame ancestors: Block all framing
      "frame-ancestors 'none'",
      // Media: Allow media from self
      "media-src 'self'",
    ].join('; '),
  },
  // Permissions Policy
  {
    key: 'Permissions-Policy',
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "fullscreen=*",
      "payment=()",
      "autoplay=*",
    ].join(', '),
  },
  // HSTS: only effective over HTTPS; keep includeSubDomains/preload if you own the domain
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for deployment
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHostname,
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig

