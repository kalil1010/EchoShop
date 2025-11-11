import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyWebhookSignature, extractSignature } from '@/lib/email/webhook-verification';
import { sendEmail } from '@/lib/email/service';
import { getConfirmationEmailTemplate } from '@/lib/email/templates';

/**
 * Supabase Auth Hook: User Confirmation Requested
 * 
 * This endpoint receives webhook events from Supabase when a user signs up
 * and needs to confirm their email address.
 * 
 * Event Type: user_confirmation_requested
 * 
 * Payload structure:
 * {
 *   "event": "user_confirmation_requested",
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "confirmation_token": "token",
 *     "confirmation_sent_at": "timestamp"
 *   },
 *   "timestamp": "2024-01-01T00:00:00Z"
 * }
 */

// Supabase Auth Hooks payload structure
// The actual payload may vary, so we'll handle multiple possible structures
const ConfirmationRequestSchema = z.object({
  event: z.string().refine((val) => val === 'user_confirmation_requested', {
    message: 'Event must be user_confirmation_requested',
  }),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    // Token might be in different fields depending on Supabase version
    confirmation_token: z.string().optional(),
    token: z.string().optional(),
    email_confirm_token: z.string().optional(),
    confirmation_sent_at: z.string().optional(),
  }),
  timestamp: z.string().optional(),
}).refine((data) => {
  // Ensure at least one token field exists
  return data.user.confirmation_token || data.user.token || data.user.email_confirm_token;
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
      console.error('[auth-hooks/send-confirmation] Invalid webhook signature');
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
      console.error('[auth-hooks/send-confirmation] Invalid JSON payload:', error);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const validationResult = ConfirmationRequestSchema.safeParse(payload);
    if (!validationResult.success) {
      console.error('[auth-hooks/send-confirmation] Invalid payload structure:', validationResult.error);
      return NextResponse.json(
        { error: 'Invalid payload structure', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { user } = validationResult.data;
    
    // Extract token from various possible fields
    const token = user.confirmation_token || user.token || user.email_confirm_token;
    if (!token) {
      console.error('[auth-hooks/send-confirmation] No token found in user object');
      return NextResponse.json(
        { error: 'Token not found in payload' },
        { status: 400 }
      );
    }
    
    // Construct confirmation URL
    // Supabase confirmation URL format: {SUPABASE_URL}/auth/v1/verify?token={token}&type=signup
    // Remove /rest/v1 if present, and ensure we have the base URL
    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (supabaseUrl.includes('/rest/v1')) {
      supabaseUrl = supabaseUrl.replace('/rest/v1', '');
    }
    // Remove trailing slash if present
    supabaseUrl = supabaseUrl.replace(/\/$/, '');
    
    const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=signup`;

    // Generate email HTML
    const emailHtml = getConfirmationEmailTemplate(user.email, confirmationUrl);

    // Send email
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Confirm Your Email Address - Echo Shop',
      html: emailHtml,
    });

    if (!emailResult.success) {
      console.error('[auth-hooks/send-confirmation] Failed to send email:', emailResult.error);
      return NextResponse.json(
        { 
          error: 'Failed to send email',
          details: emailResult.error,
        },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    console.log('[auth-hooks/send-confirmation] Email sent successfully', {
      userId: user.id,
      email: user.email,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    // Return success response to Supabase
    return NextResponse.json({
      success: true,
      message: 'Confirmation email sent',
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[auth-hooks/send-confirmation] Unexpected error:', {
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

