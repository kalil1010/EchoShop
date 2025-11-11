/**
 * Next.js configuration with basic security headers applied to all routes.
 * CSP allows Cloudflare Turnstile and Supabase resources.
 */

// Get Supabase URL for CSP and image configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : 'supabase.co'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Content Security Policy: Allow Turnstile, Supabase, and necessary resources
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://challenges.cloudflare.com/turnstile/v0/api.js",
      "style-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://challenges.cloudflare.com",
      "frame-src 'self' https://challenges.cloudflare.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
  // Limit powerful APIs by default; extend per your needs
  {
    key: 'Permissions-Policy',
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "fullscreen=(self)",
      "payment=()",
      "autoplay=(self)",
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

