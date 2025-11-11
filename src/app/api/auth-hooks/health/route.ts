import { NextResponse } from 'next/server';
import { verifyEmailConnection } from '@/lib/email/service';

/**
 * Health Check Endpoint
 * 
 * This endpoint checks the health of the email service and webhook configuration.
 * Useful for monitoring and debugging.
 */
export async function GET() {
  try {
    // Check if required environment variables are set
    const requiredEnvVars = {
      ZOHO_EMAIL_FROM: process.env.ZOHO_EMAIL_FROM,
      ZOHO_EMAIL_USER: process.env.ZOHO_EMAIL_USER,
      ZOHO_EMAIL_PASSWORD: process.env.ZOHO_EMAIL_PASSWORD ? '***' : undefined,
      SUPABASE_AUTH_HOOK_SECRET: process.env.SUPABASE_AUTH_HOOK_SECRET ? '***' : undefined,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    // Verify SMTP connection
    const smtpConnected = await verifyEmailConnection();

    const health = {
      status: missingVars.length === 0 && smtpConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        smtp: {
          connected: smtpConnected,
          host: 'smtp.zoho.com',
          port: 465,
        },
        webhook: {
          secretConfigured: !!process.env.SUPABASE_AUTH_HOOK_SECRET,
        },
      },
      environment: {
        variablesConfigured: missingVars.length === 0,
        missingVariables: missingVars,
      },
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    console.error('[auth-hooks/health] Health check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

