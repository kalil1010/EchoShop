/**
 * Email Templates
 * 
 * HTML email templates for authentication emails:
 * - Sign-up confirmation
 * - Password reset
 * - Magic link
 */

import { getAppBaseUrl } from './service';

/**
 * Base email template with Echo Shop branding
 */
function getBaseTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .email-header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .email-body {
      padding: 40px 30px;
    }
    .email-content {
      color: #555555;
      font-size: 16px;
      margin-bottom: 30px;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 10px 0;
    }
    .button:hover {
      opacity: 0.9;
    }
    .link-container {
      margin: 20px 0;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 4px;
      word-break: break-all;
    }
    .link-text {
      font-size: 12px;
      color: #666666;
      font-family: monospace;
    }
    .email-footer {
      padding: 30px;
      text-align: center;
      background-color: #f8f9fa;
      border-top: 1px solid #e9ecef;
      font-size: 14px;
      color: #888888;
    }
    .email-footer a {
      color: #667eea;
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background-color: #e9ecef;
      margin: 30px 0;
    }
    @media only screen and (max-width: 600px) {
      .email-body {
        padding: 30px 20px;
      }
      .email-header h1 {
        font-size: 24px;
      }
      .button {
        padding: 12px 24px;
        font-size: 14px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>Echo Shop</h1>
    </div>
    <div class="email-body">
      ${content}
    </div>
    <div class="email-footer">
      <p>This email was sent by Echo Shop</p>
      <p>
        <a href="${getAppBaseUrl()}/privacy">Privacy Policy</a> | 
        <a href="${getAppBaseUrl()}/terms">Terms of Service</a>
      </p>
      <p style="margin-top: 15px; font-size: 12px;">
        If you didn't request this email, you can safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Sign-up confirmation email template
 */
export function getConfirmationEmailTemplate(email: string, confirmationUrl: string): string {
  const content = `
    <h2 style="color: #333333; margin-top: 0;">Confirm Your Email Address</h2>
    <p class="email-content">
      Welcome to Echo Shop! We're excited to have you join our community.
    </p>
    <p class="email-content">
      Please confirm your email address by clicking the button below:
    </p>
    <div class="button-container">
      <a href="${confirmationUrl}" class="button">Confirm Email Address</a>
    </div>
    <div class="divider"></div>
    <p class="email-content" style="font-size: 14px; color: #666666;">
      If the button doesn't work, you can copy and paste this link into your browser:
    </p>
    <div class="link-container">
      <p class="link-text">${confirmationUrl}</p>
    </div>
    <p class="email-content" style="font-size: 14px; color: #666666;">
      This confirmation link will expire in 24 hours.
    </p>
  `;

  return getBaseTemplate(content, 'Confirm Your Email - Echo Shop');
}

/**
 * Password reset email template
 */
export function getPasswordResetEmailTemplate(email: string, resetUrl: string): string {
  const content = `
    <h2 style="color: #333333; margin-top: 0;">Reset Your Password</h2>
    <p class="email-content">
      We received a request to reset your password for your Echo Shop account.
    </p>
    <p class="email-content">
      Click the button below to create a new password:
    </p>
    <div class="button-container">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    <div class="divider"></div>
    <p class="email-content" style="font-size: 14px; color: #666666;">
      If the button doesn't work, you can copy and paste this link into your browser:
    </p>
    <div class="link-container">
      <p class="link-text">${resetUrl}</p>
    </div>
    <p class="email-content" style="font-size: 14px; color: #666666;">
      <strong>Important:</strong> This password reset link will expire in 1 hour.
    </p>
    <p class="email-content" style="font-size: 14px; color: #888888;">
      If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
    </p>
  `;

  return getBaseTemplate(content, 'Reset Your Password - Echo Shop');
}

/**
 * Magic link email template
 */
export function getMagicLinkEmailTemplate(email: string, magicLinkUrl: string): string {
  const content = `
    <h2 style="color: #333333; margin-top: 0;">Sign In to Echo Shop</h2>
    <p class="email-content">
      Click the button below to sign in to your Echo Shop account. No password required!
    </p>
    <div class="button-container">
      <a href="${magicLinkUrl}" class="button">Sign In</a>
    </div>
    <div class="divider"></div>
    <p class="email-content" style="font-size: 14px; color: #666666;">
      If the button doesn't work, you can copy and paste this link into your browser:
    </p>
    <div class="link-container">
      <p class="link-text">${magicLinkUrl}</p>
    </div>
    <p class="email-content" style="font-size: 14px; color: #666666;">
      <strong>Security Note:</strong> This magic link will expire in 1 hour and can only be used once.
    </p>
    <p class="email-content" style="font-size: 14px; color: #888888;">
      If you didn't request this sign-in link, you can safely ignore this email.
    </p>
  `;

  return getBaseTemplate(content, 'Sign In to Echo Shop');
}

