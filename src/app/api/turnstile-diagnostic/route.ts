import { NextRequest, NextResponse } from 'next/server';

/**
 * Turnstile Diagnostic Endpoint
 * 
 * This endpoint helps diagnose Turnstile CAPTCHA configuration issues.
 * It checks:
 * - Site key is configured
 * - Site key format is valid
 * - Environment variable is accessible
 * 
 * WARNING: This endpoint exposes the site key (which is public anyway).
 * Do not expose the secret key.
 */
export async function GET(request: NextRequest) {
  try {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const origin = request.headers.get('origin') || request.headers.get('referer') || 'unknown';
    const host = request.headers.get('host') || 'unknown';

    // Check if site key is set
    if (!siteKey) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Turnstile site key is not configured',
          diagnostic: {
            siteKeyConfigured: false,
            siteKeyValue: null,
            siteKeyLength: 0,
            siteKeyFormat: 'invalid',
            recommendations: [
              'Set NEXT_PUBLIC_TURNSTILE_SITE_KEY in Railway environment variables',
              'Get your site key from Cloudflare Turnstile Dashboard',
              'Make sure the environment variable is prefixed with NEXT_PUBLIC_',
            ],
          },
        },
        { status: 200 }
      );
    }

    // Validate site key format
    // Turnstile site keys typically start with 0x4AAAAAAA or similar
    const siteKeyTrimmed = siteKey.trim();
    const isValidFormat = /^0x4[A-Za-z0-9_-]+$/.test(siteKeyTrimmed);
    const isExpectedLength = siteKeyTrimmed.length >= 40 && siteKeyTrimmed.length <= 100;

    // Extract domain from origin/referer
    let domain = 'unknown';
    try {
      if (origin !== 'unknown') {
        const url = new URL(origin);
        domain = url.hostname;
      } else if (host !== 'unknown') {
        domain = host.split(':')[0]; // Remove port if present
      }
    } catch {
      // Ignore URL parsing errors
    }

    return NextResponse.json(
      {
        status: isValidFormat && isExpectedLength ? 'ok' : 'warning',
        message: isValidFormat && isExpectedLength
          ? 'Turnstile site key is configured'
          : 'Turnstile site key format may be invalid',
        diagnostic: {
          siteKeyConfigured: true,
          siteKeyValue: siteKeyTrimmed.substring(0, 20) + '...', // Show first 20 chars
          siteKeyLength: siteKeyTrimmed.length,
          siteKeyFormat: isValidFormat ? 'valid' : 'invalid',
          siteKeyStartsWith: siteKeyTrimmed.substring(0, 10),
          isExpectedLength,
          domain,
          origin,
          host,
          recommendations: [
            isValidFormat
              ? null
              : 'Site key format appears invalid. Turnstile keys typically start with 0x4AAAAAAA',
            isExpectedLength
              ? null
              : 'Site key length is unusual. Typical Turnstile keys are 40-100 characters',
            'Verify the site key in Cloudflare Turnstile Dashboard',
            `Ensure your domain "${domain}" is in the allowed domains list in Cloudflare Turnstile`,
            'Verify the secret key in Supabase Dashboard matches this site key',
            'Both keys must be from the same Turnstile site in Cloudflare',
          ].filter(Boolean) as string[],
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Diagnostic check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

