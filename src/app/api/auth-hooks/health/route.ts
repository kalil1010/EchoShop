import { NextResponse } from 'next/server';
import { verifyEmailConnection, validateEmailConfiguration } from '@/lib/email/service';

/**
 * Health Check Endpoint
 * 
 * This endpoint checks the health of the email service and webhook configuration.
 * Useful for monitoring and debugging.
 */
export async function GET() {
  try {
    // Validate email configuration using the validation function
    const configValidation = validateEmailConfiguration();

    // Verify SMTP connection
    const smtpConnected = await verifyEmailConnection();

    const health = {
      status: configValidation.valid && smtpConnected ? 'healthy' : 'unhealthy',
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
        variablesConfigured: configValidation.valid,
        missingVariables: configValidation.errors,
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

