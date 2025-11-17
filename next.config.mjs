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
      // Scripts: Allow Turnstile, Next.js, and inline scripts
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://*.cloudflare.com",
      // Styles: Allow Turnstile and inline styles
      "style-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://*.cloudflare.com",
      // Images: Allow all HTTPS images (needed for Turnstile and user content)
      "img-src 'self' data: https: blob:",
      // Fonts: Allow self and data URIs
      "font-src 'self' data: https:",
      // Connect: Allow Supabase (HTTP/HTTPS and WebSocket), Cloudflare challenge platform, Turnstile API, and ipinfo.io for location
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://challenges.cloudflare.com https://*.cloudflare.com https://challenges.cloudflare.com/cdn-cgi/challenge-platform/ https://ipinfo.io",
      // Frames: Allow Turnstile widgets and Cloudflare challenge platform
      "frame-src 'self' https://challenges.cloudflare.com https://*.cloudflare.com",
      // Workers: Allow blob workers for Turnstile
      "worker-src 'self' blob: https://challenges.cloudflare.com",
      // Objects: Block all objects
      "object-src 'none'",
      // Base URI: Restrict to self
      "base-uri 'self'",
      // Form actions: Allow self and Supabase
      "form-action 'self' https://*.supabase.co",
      // Frame ancestors: Block all framing
      "frame-ancestors 'none'",
      // Media: Allow media from self and Cloudflare
      "media-src 'self' https://*.cloudflare.com",
    ].join('; '),
  },
  // Permissions Policy: Allow Turnstile to use autoplay and fullscreen
  // Note: URLs in allowlists must be quoted. Using * for fullscreen/autoplay since
  // Turnstile runs in an iframe and needs these permissions
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
      // Prevent browser caching of dashboard pages
      {
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      // CDN caching headers for static images
      {
        source: '/api/image-generator',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default nextConfig

