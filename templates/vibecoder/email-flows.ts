/**
 * Complete Email Flows
 * 
 * What AI app builders forget: Verification, password reset, notifications
 */

import { emailService } from '../backend/utils/email.util';
import { query } from '../backend/utils/database.util';
import { randomBytes } from 'crypto';
import { logger } from '../backend/utils/logger.util';

/**
 * Send email verification
 */
export async function sendEmailVerification(
  userId: string,
  email: string
): Promise<void> {
  // Generate verification token
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Store token
  await query(
    `INSERT INTO email_verifications (user_id, token, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) 
     DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
    [userId, token, expiresAt]
  );

  // Send email
  await emailService.sendVerificationEmail(email, token);

  logger.info('Email verification sent', { userId, email });
}

/**
 * Verify email
 */
export async function verifyEmail(token: string): Promise<boolean> {
  const result = await query(
    `SELECT user_id, expires_at FROM email_verifications 
     WHERE token = $1 AND verified = false`,
    [token]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const { user_id, expires_at } = result.rows[0];

  if (new Date(expires_at) < new Date()) {
    return false; // Expired
  }

  // Mark as verified
  await query(
    `UPDATE users SET email_verified = true WHERE id = $1`,
    [user_id]
  );

  await query(
    `UPDATE email_verifications SET verified = true WHERE token = $1`,
    [token]
  );

  logger.info('Email verified', { userId: user_id });
  return true;
}

/**
 * Send password reset
 */
export async function sendPasswordReset(email: string): Promise<void> {
  // Find user
  const userResult = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (userResult.rows.length === 0) {
    // Don't reveal if email exists (security)
    return;
  }

  const userId = userResult.rows[0].id;

  // Generate reset token
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store token
  await query(
    `INSERT INTO password_resets (user_id, token, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id)
     DO UPDATE SET token = $2, expires_at = $3, created_at = NOW()`,
    [userId, token, expiresAt]
  );

  // Send email
  await emailService.sendPasswordResetEmail(email, token);

  logger.info('Password reset email sent', { userId, email });
}

/**
 * Reset password
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<boolean> {
  const result = await query(
    `SELECT user_id, expires_at, used FROM password_resets 
     WHERE token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const { user_id, expires_at, used } = result.rows[0];

  if (used) {
    return false; // Already used
  }

  if (new Date(expires_at) < new Date()) {
    return false; // Expired
  }

  // Hash new password
  const { hashPassword } = require('../backend/utils/password.util');
  const hashedPassword = await hashPassword(newPassword);

  // Update password
  await query(
    `UPDATE users SET password_hash = $1 WHERE id = $2`,
    [hashedPassword, user_id]
  );

  // Mark token as used
  await query(
    `UPDATE password_resets SET used = true WHERE token = $1`,
    [token]
  );

  logger.info('Password reset', { userId: user_id });
  return true;
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(
  userId: string,
  email: string,
  name: string
): Promise<void> {
  await emailService.sendWelcomeEmail(email, name);
  logger.info('Welcome email sent', { userId, email });
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
  userId: string,
  email: string,
  subject: string,
  message: string
): Promise<void> {
  await emailService.sendEmail({
    to: email,
    subject,
    html: `
      <h1>${subject}</h1>
      <p>${message}</p>
      <p>Best regards,<br>Your App Team</p>
    `,
  });

  logger.info('Notification email sent', { userId, email, subject });
}

