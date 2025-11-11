import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug Endpoint for Auth Hooks
 * 
 * This endpoint logs the raw payload received from Supabase Auth Hooks
 * for debugging purposes. Disabled in production for security.
 * 
 * WARNING: This endpoint logs sensitive information. Use only for debugging.
 */
export async function POST(request: NextRequest) {
  // Disable debug endpoint in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoint disabled in production' },
      { status: 403 }
    );
  }

  // Also check for explicit debug mode flag (allows disabling even in development)
  if (process.env.ENABLE_DEBUG_ENDPOINT === 'false') {
    return NextResponse.json(
      { error: 'Debug endpoint is disabled' },
      { status: 403 }
    );
  }

  try {
    const rawBody = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = { raw: rawBody };
    }

    const debugInfo = {
      timestamp: new Date().toISOString(),
      headers: {
        'x-supabase-signature': headers['x-supabase-signature'] || headers['X-Supabase-Signature'] || 'missing',
        'content-type': headers['content-type'] || 'missing',
        'user-agent': headers['user-agent'] || 'missing',
      },
      payload: parsedBody,
      payloadKeys: parsedBody && typeof parsedBody === 'object' ? Object.keys(parsedBody) : [],
    };

    console.log('[auth-hooks/debug] Received webhook payload:', JSON.stringify(debugInfo, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Debug information logged',
      debug: debugInfo,
    });
  } catch (error) {
    console.error('[auth-hooks/debug] Error processing debug request:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

