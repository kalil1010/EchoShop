import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug Endpoint for Auth Hooks
 * 
 * This endpoint logs the raw payload received from Supabase Auth Hooks
 * for debugging purposes. Should be disabled in production or protected.
 * 
 * WARNING: This endpoint logs sensitive information. Use only for debugging.
 */
export async function POST(request: NextRequest) {
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

