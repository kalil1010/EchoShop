import { createHmac } from 'crypto';

/**
 * Webhook Signature Verification
 * 
 * Verifies that webhook requests from Supabase Auth Hooks are authentic
 * by checking the HMAC signature using a shared secret.
 */

const WEBHOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET;

/**
 * Verify webhook signature
 * 
 * Supabase Auth Hooks send requests with an 'x-supabase-signature' header
 * containing an HMAC-SHA256 signature of the request body.
 * 
 * @param payload - The raw request body as a string
 * @param signature - The signature from the 'x-supabase-signature' header
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('[webhook-verification] WEBHOOK_SECRET not configured');
    return false;
  }

  if (!signature) {
    console.error('[webhook-verification] Missing signature header');
    return false;
  }

  try {
    // Create HMAC signature
    const hmac = createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Supabase may send signature in different formats:
    // - Plain hex: "abc123..."
    // - With prefix: "sha256=abc123..."
    // - Base64 encoded
    let receivedSignature = signature.trim();
    
    // Remove common prefixes
    if (receivedSignature.startsWith('sha256=')) {
      receivedSignature = receivedSignature.substring(7);
    }
    if (receivedSignature.startsWith('sha256:')) {
      receivedSignature = receivedSignature.substring(7);
    }
    
    // Try hex comparison first (most common)
    let isValid = false;
    
    // Compare signatures using constant-time comparison to prevent timing attacks
    if (expectedSignature.length === receivedSignature.length) {
      let result = 0;
      for (let i = 0; i < expectedSignature.length; i++) {
        result |= expectedSignature.charCodeAt(i) ^ receivedSignature.charCodeAt(i);
      }
      isValid = result === 0;
    }
    
    // If hex comparison failed, try base64 (less common but possible)
    if (!isValid) {
      try {
        const expectedBase64 = Buffer.from(expectedSignature, 'hex').toString('base64');
        if (expectedBase64 === receivedSignature) {
          isValid = true;
        }
      } catch {
        // Ignore base64 comparison errors
      }
    }

    if (!isValid) {
      console.warn('[webhook-verification] Signature verification failed', {
        expectedLength: expectedSignature.length,
        receivedLength: receivedSignature.length,
        receivedPrefix: receivedSignature.substring(0, 10) + '...',
        // Don't log full signatures for security
      });
    }

    return isValid;
  } catch (error) {
    console.error('[webhook-verification] Error verifying signature:', error);
    return false;
  }
}

/**
 * Extract signature from request headers
 */
export function extractSignature(headers: Headers): string | null {
  // Check both possible header names (case-insensitive)
  const signatureHeader = headers.get('x-supabase-signature') || 
                         headers.get('X-Supabase-Signature');
  return signatureHeader;
}

