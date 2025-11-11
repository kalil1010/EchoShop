import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyWebhookSignature, extractSignature } from '@/lib/email/webhook-verification';
import { sendEmail, maskEmail } from '@/lib/email/service';
import { getMagicLinkEmailTemplate } from '@/lib/email/templates';
import { checkRateLimit } from '@/lib/email/rate-limiter';

/**
 * Supabase Auth Hook: User Magic Link Requested
 * 
 * This endpoint receives webhook events from Supabase when a user requests
 * a magic link for passwordless authentication.
 * 
 * Event Type: user_magic_link_requested
 * 
 * Payload structure:
 * {
 *   "event": "user_magic_link_requested",
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "magic_link_token": "token",
 *     "magic_link_sent_at": "timestamp"
 *   },
 *   "timestamp": "2024-01-01T00:00:00Z"
 * }
 */

// Supabase Auth Hooks payload structure
//
// Supabase webhook token field mapping by version:
// - Supabase v1.x / GoTrue v1.x: magic_link_token (standard)
// - Supabase v2.x / GoTrue v2.x: token (generic field)
// - Some configurations: magiclink_token (alternative naming, no underscore)
//
// This flexible approach ensures compatibility across different Supabase versions
// and configuration setups. We check multiple field names to handle all cases.
const MagicLinkRequestSchema = z.object({
  event: z.string().refine((val) => val === 'user_magic_link_requested', {
    message: 'Event must be user_magic_link_requested',
  }),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    // Token field variations (handles multiple Supabase versions):
    magic_link_token: z.string().optional(), // v1.x standard
    token: z.string().optional(), // v2.x generic field
    magiclink_token: z.string().optional(), // alternative naming (no underscore)
    magic_link_sent_at: z.string().optional(),
  }),
  timestamp: z.string().optional(),
}).refine((data) => {
  // Ensure at least one token field exists
  return data.user.magic_link_token || data.user.token || data.user.magiclink_token;
}, {
  message: 'Token is required in user object',
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Verify webhook signature
    const signature = extractSignature(request.headers);
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('[auth-hooks/send-magic-link] Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse and validate payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      console.error('[auth-hooks/send-magic-link] Invalid JSON payload:', error);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const validationResult = MagicLinkRequestSchema.safeParse(payload);
    if (!validationResult.success) {
      console.error('[auth-hooks/send-magic-link] Invalid payload structure:', validationResult.error);
      return NextResponse.json(
        { error: 'Invalid payload structure', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { user } = validationResult.data;
    
    // Rate limiting: Prevent email spam (10 emails per hour per user)
    // Using user ID as identifier for rate limiting
    const rateLimit = checkRateLimit(user.id, 10, 60 * 60 * 1000); // 10 requests per hour
    if (!rateLimit.allowed) {
      console.warn('[auth-hooks/send-magic-link] Rate limit exceeded', {
        userId: user.id,
        email: maskEmail(user.email),
        remaining: rateLimit.remaining,
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      });
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }
    
    // Extract token from various possible fields
    const token = user.magic_link_token || user.token || user.magiclink_token;
    if (!token) {
      console.error('[auth-hooks/send-magic-link] No token found in user object');
      return NextResponse.json(
        { error: 'Token not found in payload' },
        { status: 400 }
      );
    }
    
    // Construct magic link URL
    // Supabase magic link URL format: {SUPABASE_URL}/auth/v1/verify?token={token}&type=magiclink
    // Remove /rest/v1 if present, and ensure we have the base URL
    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (supabaseUrl.includes('/rest/v1')) {
      supabaseUrl = supabaseUrl.replace('/rest/v1', '');
    }
    // Remove trailing slash if present
    supabaseUrl = supabaseUrl.replace(/\/$/, '');
    
    const magicLinkUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=magiclink`;

    // Generate email HTML
    const emailHtml = getMagicLinkEmailTemplate(user.email, magicLinkUrl);

    // Send email
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Sign In to Echo Shop',
      html: emailHtml,
    });

    if (!emailResult.success) {
      console.error('[auth-hooks/send-magic-link] Failed to send email:', emailResult.error);
      return NextResponse.json(
        { 
          error: 'Failed to send email',
          details: emailResult.error,
        },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log('[auth-hooks/send-magic-link] Email sent successfully', {
      userId: user.id,
      email: maskEmail(user.email), // Mask email for privacy
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    // Return success response to Supabase
    return NextResponse.json({
      success: true,
      message: 'Magic link email sent',
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[auth-hooks/send-magic-link] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

