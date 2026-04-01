/**
 * Email Service
 *
 * Handles sending transactional emails using Resend
 */


import { logger } from "../logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@guardrailai.dev";
const APP_URL = process.env.FRONTEND_URL || "https://guardrailai.dev";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!RESEND_API_KEY) {
      logger.warn("RESEND_API_KEY not configured, skipping email send");
      logger.info(`Would send email to ${options.to}: ${options.subject}`);
      return true; // Return true in dev mode
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error("Failed to send email: " + error + " to: " + options.to);
        return false;
      }

      logger.info("Email sent successfully to: " + options.to);
      return true;
    } catch (error) {
      logger.error("Email service error: " + String(error));
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<boolean> {
    const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a;">
          <tr>
            <td style="padding: 40px;">
              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 32px;">
                <span style="font-size: 28px; font-weight: bold; background: linear-gradient(to right, #34d399, #2dd4bf, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  guardrail
                </span>
              </div>
              
              <!-- Title -->
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
                Reset Your Password
              </h1>
              
              <!-- Message -->
              <p style="color: #a1a1aa; font-size: 16px; line-height: 24px; text-align: center; margin: 0 0 32px 0;">
                We received a request to reset your password. Click the button below to choose a new password.
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin-bottom: 32px;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(to right, #2563eb, #3b82f6); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                  Reset Password
                </a>
              </div>
              
              <!-- Expiry notice -->
              <p style="color: #71717a; font-size: 14px; text-align: center; margin: 0 0 24px 0;">
                This link will expire in 1 hour.
              </p>
              
              <!-- Alternative link -->
              <p style="color: #71717a; font-size: 12px; text-align: center; margin: 0; word-break: break-all;">
                If the button doesn't work, copy and paste this link:<br>
                <a href="${resetUrl}" style="color: #3b82f6;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #27272a;">
              <p style="color: #52525b; font-size: 12px; text-align: center; margin: 0;">
                If you didn't request this password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Company footer -->
        <p style="color: #52525b; font-size: 12px; text-align: center; margin-top: 24px;">
          © ${new Date().getFullYear()} guardrail. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const text = `
Reset Your Password

We received a request to reset your password. Click the link below to choose a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email.

© ${new Date().getFullYear()} guardrail. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: "Reset Your Password - guardrail",
      html,
      text,
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, name?: string): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to guardrail</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a;">
          <tr>
            <td style="padding: 40px;">
              <!-- Logo -->
              <div style="text-align: center; margin-bottom: 32px;">
                <span style="font-size: 28px; font-weight: bold; background: linear-gradient(to right, #34d399, #2dd4bf, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  guardrail
                </span>
              </div>
              
              <!-- Title -->
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 16px 0;">
                Welcome to guardrail${name ? `, ${name}` : ""}! 🚀
              </h1>
              
              <!-- Message -->
              <p style="color: #a1a1aa; font-size: 16px; line-height: 24px; text-align: center; margin: 0 0 32px 0;">
                You're all set to start shipping with confidence. guardrail helps you catch security issues, mock data, and code quality problems before they reach production.
              </p>
              
              <!-- Button -->
              <div style="text-align: center; margin-bottom: 32px;">
                <a href="${APP_URL}/dashboard" style="display: inline-block; background: linear-gradient(to right, #10b981, #14b8a6); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                  Go to Dashboard
                </a>
              </div>
              
              <!-- Features -->
              <div style="background-color: #27272a; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">What you can do:</p>
                <ul style="color: #a1a1aa; font-size: 14px; line-height: 24px; margin: 0; padding-left: 20px;">
                  <li>Run security scans on your repositories</li>
                  <li>Detect mock data with Reality Mode</li>
                  <li>Get GO/NO-GO verdicts with Ship Check</li>
                  <li>Integrate with your CI/CD pipeline</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #27272a;">
              <p style="color: #52525b; font-size: 12px; text-align: center; margin: 0;">
                Need help? Reply to this email or visit our <a href="${APP_URL}/docs" style="color: #3b82f6;">documentation</a>.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Company footer -->
        <p style="color: #52525b; font-size: 12px; text-align: center; margin-top: 24px;">
          © ${new Date().getFullYear()} guardrail. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.sendEmail({
      to: email,
      subject: "Welcome to guardrail! 🚀",
      html,
    });
  }
}

export const emailService = new EmailService();
