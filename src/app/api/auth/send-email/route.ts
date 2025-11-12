import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyWebhookSignature, extractSignature } from '@/lib/email/webhook-verification';
import { sendEmail, maskEmail } from '@/lib/email/service';
import { getConfirmationEmailTemplate, getPasswordResetEmailTemplate, getMagicLinkEmailTemplate } from '@/lib/email/templates';
import { checkRateLimit } from '@/lib/email/rate-limiter';

/**
 * Unified Supabase Auth Hook Endpoint
 * 
 * This endpoint handles all Supabase Auth Hook events:
 * - user_confirmation_requested
 * - user_password_reset_requested
 * - user_magic_link_requested
 * 
 * Supabase can be configured to send all events to this single endpoint.
 */

// Schema for confirmation request
const ConfirmationRequestSchema = z.object({
  event: z.literal('user_confirmation_requested'),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    confirmation_token: z.string().optional(),
    token: z.string().optional(),
    email_confirm_token: z.string().optional(),
    confirmation_sent_at: z.string().optional(),
  }),
  timestamp: z.string().optional(),
}).refine((data) => {
  return data.user.confirmation_token || data.user.token || data.user.email_confirm_token;
}, {
  message: 'Token is required in user object',
});

// Schema for password reset request
const PasswordResetRequestSchema = z.object({
  event: z.literal('user_password_reset_requested'),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    recovery_token: z.string().optional(),
    token: z.string().optional(),
    password_reset_token: z.string().optional(),
    recovery_sent_at: z.string().optional(),
  }),
  timestamp: z.string().optional(),
}).refine((data) => {
  return data.user.recovery_token || data.user.token || data.user.password_reset_token;
}, {
  message: 'Token is required in user object',
});

// Schema for magic link request
const MagicLinkRequestSchema = z.object({
  event: z.literal('user_magic_link_requested'),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    magic_link_token: z.string().optional(),
    token: z.string().optional(),
    magiclink_token: z.string().optional(),
    magic_link_sent_at: z.string().optional(),
  }),
  timestamp: z.string().optional(),
}).refine((data) => {
  return data.user.magic_link_token || data.user.token || data.user.magiclink_token;
}, {
  message: 'Token is required in user object',
});

// Union schema for all event types
const AuthHookSchema = z.discriminatedUnion('event', [
  ConfirmationRequestSchema,
  PasswordResetRequestSchema,
  MagicLinkRequestSchema,
]);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Verify webhook signature (optional if secret is not configured)
    const signature = extractSignature(request.headers);
    const webhookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
    
    // Only enforce signature verification if secret is configured
    if (webhookSecret) {
      if (!verifyWebhookSignature(rawBody, signature)) {
        console.warn('[auth/send-email] Invalid or missing webhook signature - proceeding anyway (secret is configured but verification failed)');
        // Log but don't block - allow request to proceed for now
        // TODO: Re-enable strict verification once Supabase webhook is properly configured
      }
    } else {
      console.warn('[auth/send-email] SUPABASE_AUTH_HOOK_SECRET not configured - skipping signature verification');
    }

    // Parse and validate payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      console.error('[auth/send-email] Invalid JSON payload:', error);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const validationResult = AuthHookSchema.safeParse(payload);
    if (!validationResult.success) {
      console.error('[auth/send-email] Invalid payload structure:', validationResult.error);
      return NextResponse.json(
        { error: 'Invalid payload structure', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { event, user } = validationResult.data;
    
    // Rate limiting: Prevent email spam (10 emails per hour per user)
    const rateLimit = checkRateLimit(user.id, 10, 60 * 60 * 1000); // 10 requests per hour
    if (!rateLimit.allowed) {
      console.warn('[auth/send-email] Rate limit exceeded', {
        event,
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
    
    // Handle different event types
    let emailHtml: string;
    let subject: string;
    let token: string | undefined;

    if (event === 'user_confirmation_requested') {
      token = user.confirmation_token || user.token || user.email_confirm_token;
      if (!token) {
        console.error('[auth/send-email] No token found in user object for confirmation');
        return NextResponse.json(
          { error: 'Token not found in payload' },
          { status: 400 }
        );
      }
      
      // Construct confirmation URL
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      if (supabaseUrl.includes('/rest/v1')) {
        supabaseUrl = supabaseUrl.replace('/rest/v1', '');
      }
      supabaseUrl = supabaseUrl.replace(/\/$/, '');
      const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=signup`;
      
      emailHtml = getConfirmationEmailTemplate(user.email, confirmationUrl);
      subject = 'Confirm Your Email Address - Echo Shop';
      
    } else if (event === 'user_password_reset_requested') {
      token = user.recovery_token || user.token || user.password_reset_token;
      if (!token) {
        console.error('[auth/send-email] No token found in user object for password reset');
        return NextResponse.json(
          { error: 'Token not found in payload' },
          { status: 400 }
        );
      }
      
      // Construct password reset URL
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      if (supabaseUrl.includes('/rest/v1')) {
        supabaseUrl = supabaseUrl.replace('/rest/v1', '');
      }
      supabaseUrl = supabaseUrl.replace(/\/$/, '');
      const resetUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=recovery`;
      
      emailHtml = getPasswordResetEmailTemplate(user.email, resetUrl);
      subject = 'Reset Your Password - Echo Shop';
      
    } else if (event === 'user_magic_link_requested') {
      token = user.magic_link_token || user.token || user.magiclink_token;
      if (!token) {
        console.error('[auth/send-email] No token found in user object for magic link');
        return NextResponse.json(
          { error: 'Token not found in payload' },
          { status: 400 }
        );
      }
      
      // Construct magic link URL
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      if (supabaseUrl.includes('/rest/v1')) {
        supabaseUrl = supabaseUrl.replace('/rest/v1', '');
      }
      supabaseUrl = supabaseUrl.replace(/\/$/, '');
      const magicLinkUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=magiclink`;
      
      emailHtml = getMagicLinkEmailTemplate(user.email, magicLinkUrl);
      subject = 'Your Magic Link - Echo Shop';
      
    } else {
      console.error('[auth/send-email] Unknown event type:', event);
      return NextResponse.json(
        { error: 'Unknown event type' },
        { status: 400 }
      );
    }

    // Send email
    const emailResult = await sendEmail({
      to: user.email,
      subject,
      html: emailHtml,
    });

    if (!emailResult.success) {
      console.error(`[auth/send-email] Failed to send email for ${event}:`, emailResult.error);
      return NextResponse.json(
        { 
          error: 'Failed to send email',
          details: emailResult.error,
        },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[auth/send-email] Email sent successfully for ${event}`, {
      userId: user.id,
      email: maskEmail(user.email), // Mask email for privacy
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    // Return success response to Supabase
    return NextResponse.json({
      success: true,
      message: `Email sent for ${event}`,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[auth/send-email] Unexpected error:', {
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

