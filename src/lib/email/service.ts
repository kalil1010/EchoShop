import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';

/**
 * Email Service
 * 
 * Handles email delivery through Zoho Mail SMTP using Nodemailer.
 * Provides retry logic, connection pooling, and error handling.
 */

// Zoho Mail SMTP configuration
const ZOHO_SMTP_HOST = 'smtp.zoho.com';
const ZOHO_SMTP_PORT = 465;
const ZOHO_SMTP_SECURE = true; // Use SSL

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Initial delay: 1 second
const RETRY_BACKOFF_MULTIPLIER = 2; // Exponential backoff

// Email configuration from environment variables
const EMAIL_FROM = process.env.ZOHO_EMAIL_FROM;
const EMAIL_USER = process.env.ZOHO_EMAIL_USER;
const EMAIL_PASSWORD = process.env.ZOHO_EMAIL_PASSWORD;
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') || 'https://echo-shop.app';

/**
 * Create and configure Nodemailer transporter
 */
function createTransporter(): Transporter {
  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    throw new Error('Zoho email credentials not configured. Please set ZOHO_EMAIL_USER and ZOHO_EMAIL_PASSWORD environment variables.');
  }

  if (!EMAIL_FROM) {
    throw new Error('Zoho email FROM address not configured. Please set ZOHO_EMAIL_FROM environment variable.');
  }

  return nodemailer.createTransport({
    host: ZOHO_SMTP_HOST,
    port: ZOHO_SMTP_PORT,
    secure: ZOHO_SMTP_SECURE,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
    // Connection pool settings
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    // Timeout settings
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 5000, // 5 seconds
    socketTimeout: 10000, // 10 seconds
  });
}

/**
 * Verify SMTP connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('[email-service] SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('[email-service] SMTP connection verification failed:', error);
    return false;
  }
}

/**
 * Send email with retry logic
 */
async function sendEmailWithRetry(
  mailOptions: SendMailOptions,
  retryCount = 0
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    
    // Mask email address in logs for privacy
    let maskedTo = 'unknown';
    if (typeof mailOptions.to === 'string') {
      maskedTo = maskEmail(mailOptions.to);
    } else if (Array.isArray(mailOptions.to)) {
      maskedTo = mailOptions.to
        .map(addr => typeof addr === 'string' ? maskEmail(addr) : maskEmail(addr.address || 'unknown'))
        .join(', ');
    } else if (mailOptions.to && typeof mailOptions.to === 'object' && 'address' in mailOptions.to) {
      maskedTo = maskEmail(mailOptions.to.address);
    }
    
    console.log('[email-service] Email sent successfully:', {
      messageId: info.messageId,
      to: maskedTo,
      subject: mailOptions.subject,
      timestamp: new Date().toISOString(),
    });
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Mask email address in logs for privacy
    let maskedTo = 'unknown';
    if (typeof mailOptions.to === 'string') {
      maskedTo = maskEmail(mailOptions.to);
    } else if (Array.isArray(mailOptions.to)) {
      maskedTo = mailOptions.to
        .map(addr => typeof addr === 'string' ? maskEmail(addr) : maskEmail(addr.address || 'unknown'))
        .join(', ');
    } else if (mailOptions.to && typeof mailOptions.to === 'object' && 'address' in mailOptions.to) {
      maskedTo = maskEmail(mailOptions.to.address);
    }
    
    console.error(`[email-service] Email send attempt ${retryCount + 1} failed:`, {
      error: errorMessage,
      to: maskedTo,
      subject: mailOptions.subject,
      timestamp: new Date().toISOString(),
    });

    // Retry logic
    if (retryCount < MAX_RETRIES - 1) {
      const delay = RETRY_DELAY_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, retryCount);
      console.log(`[email-service] Retrying in ${delay}ms... (attempt ${retryCount + 2}/${MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendEmailWithRetry(mailOptions, retryCount + 1);
    }

    // All retries exhausted
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send email
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!EMAIL_FROM) {
    return {
      success: false,
      error: 'Email FROM address not configured',
    };
  }

  const mailOptions: SendMailOptions = {
    from: EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    headers: {
      // RFC 8058: List-Unsubscribe header for better deliverability
      // Even for transactional emails, this improves spam score
      'List-Unsubscribe': `<${getAppBaseUrl()}/unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      // X-Auto-Response-Suppress header to prevent auto-responders
      'X-Auto-Response-Suppress': 'All',
    },
  };

  return sendEmailWithRetry(mailOptions);
}

/**
 * Get application base URL for email links
 */
export function getAppBaseUrl(): string {
  return APP_BASE_URL;
}

/**
 * Validate email service configuration
 * 
 * Checks that all required environment variables are set.
 * Call this during app startup to catch configuration errors early.
 * 
 * @returns Validation result with list of missing variables
 */
export function validateEmailConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!process.env.ZOHO_EMAIL_FROM) {
    errors.push('ZOHO_EMAIL_FROM');
  }

  if (!process.env.ZOHO_EMAIL_USER) {
    errors.push('ZOHO_EMAIL_USER');
  }

  if (!process.env.ZOHO_EMAIL_PASSWORD) {
    errors.push('ZOHO_EMAIL_PASSWORD');
  }

  if (!process.env.SUPABASE_AUTH_HOOK_SECRET) {
    errors.push('SUPABASE_AUTH_HOOK_SECRET');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Mask email address for logging
 * 
 * Masks the local part of an email address to protect user privacy in logs.
 * Example: user@example.com -> us***@example.com
 * 
 * @param email - Email address to mask
 * @returns Masked email address
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }

  // Show first 2 characters, mask the rest
  const masked = localPart.substring(0, 2) + '***';
  return `${masked}@${domain}`;
}

