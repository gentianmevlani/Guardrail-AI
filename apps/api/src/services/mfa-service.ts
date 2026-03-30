/**
 * Multi-Factor Authentication (MFA) Service
 * 
 * Handles TOTP (Time-based One-Time Password) generation, verification,
 * backup code generation, and MFA management for users.
 */

import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { prisma } from '@guardrail/database';
import { logger } from '../logger';
import { securityEventService } from './security-event-service';

// Encryption utilities for MFA secrets
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Get encryption key from environment or generate a default (for development)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.MFA_ENCRYPTION_KEY;
  if (!key) {
    logger.warn('MFA_ENCRYPTION_KEY not set, using default (NOT SECURE FOR PRODUCTION)');
    // In production, this should be a proper 32-byte key from env
    return crypto.scryptSync('default-key-change-in-production', 'salt', 32);
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt MFA secret before storing in database
 */
function encryptSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  
  // Return IV + tag + encrypted data as hex string
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt MFA secret from database
 */
function decryptSecret(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encryptedData = parts[2];
  
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate backup codes for MFA recovery
 */
function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-digit codes
    const code = crypto.randomInt(10000000, 99999999).toString();
    codes.push(code);
  }
  return codes;
}

/**
 * Hash backup code for storage (one-way hash)
 */
function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * MFA Service Class
 */
export class MFAService {
  /**
   * Generate TOTP secret and QR code for MFA setup
   */
  async generateMFASecret(userId: string, userEmail: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `guardrail (${userEmail})`,
      issuer: 'guardrail',
      length: 32,
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);

    // Encrypt secret and backup codes before storing
    const encryptedSecret = encryptSecret(secret.base32 || '');
    const encryptedBackupCodes = backupCodes.map(hashBackupCode);

    // Store encrypted secret and backup codes (but don't mark as verified yet)
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: encryptedSecret,
        mfaBackupCodes: encryptedBackupCodes,
        // Don't set mfaEnabled yet - user needs to verify first
      },
    });

    // Log security event (using existing event type)
    await securityEventService.emit({
      eventType: 'admin_action', // Using admin_action as closest match
      payload: { action: 'mfa_setup_initiated', userId },
      userId,
      severity: 'medium',
    });

    logger.info({ userId }, 'MFA secret generated');

    return {
      secret: secret.base32 || '',
      qrCodeUrl,
      backupCodes, // Return plain codes for user to save
    };
  }

  /**
   * Verify TOTP code during MFA setup
   */
  async verifyMFASetup(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true },
    });

    if (!user || !user.mfaSecret) {
      throw new Error('MFA secret not found. Please generate a new secret.');
    }

    // Decrypt secret
    const secret = decryptSecret(user.mfaSecret);

    // Verify token
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps (60 seconds) of tolerance
    });

    if (isValid) {
      // Mark MFA as enabled and verified
      await prisma.user.update({
        where: { id: userId },
        data: {
          mfaEnabled: true,
          mfaVerifiedAt: new Date(),
        },
      });

      // Log security event
      await securityEventService.emit({
        eventType: 'admin_action',
        payload: { action: 'mfa_enabled', userId },
        userId,
        severity: 'medium',
      });

      logger.info({ userId }, 'MFA enabled successfully');
    } else {
      // Log failed attempt
      await securityEventService.emit({
        eventType: 'access_denied',
        payload: { action: 'mfa_setup_failed', userId },
        userId,
        severity: 'low',
      });
    }

    return isValid;
  }

  /**
   * Verify TOTP code during authentication
   */
  async verifyMFAToken(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return false;
    }

    // Decrypt secret
    const secret = decryptSecret(user.mfaSecret);

    // Verify token
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (isValid) {
      logger.debug({ userId }, 'MFA token verified');
    } else {
      // Log failed attempt
      await securityEventService.emit({
        eventType: 'access_denied',
        payload: { action: 'mfa_verification_failed', userId },
        userId,
        severity: 'medium',
      });
    }

    return isValid;
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaBackupCodes: true },
    });

    if (!user || !user.mfaEnabled || !user.mfaBackupCodes) {
      return false;
    }

    // Hash the provided code
    const hashedCode = hashBackupCode(code);

    // Check if code exists in backup codes
    const codeIndex = user.mfaBackupCodes.indexOf(hashedCode);
    if (codeIndex === -1) {
      // Log failed attempt
      await securityEventService.emit({
        eventType: 'access_denied',
        payload: { action: 'mfa_backup_code_failed', userId },
        userId,
        severity: 'medium',
      });
      return false;
    }

    // Remove used backup code
    const updatedCodes = [...user.mfaBackupCodes];
    updatedCodes.splice(codeIndex, 1);

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaBackupCodes: updatedCodes,
      },
    });

    // Log successful use
    await securityEventService.emit({
      eventType: 'admin_action',
      payload: { action: 'mfa_backup_code_used', userId, remainingCodes: updatedCodes.length },
      userId,
      severity: 'low',
    });

    logger.info({ userId, remainingCodes: updatedCodes.length }, 'Backup code used');

    return true;
  }

  /**
   * Disable MFA for a user (requires password verification)
   */
  async disableMFA(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        mfaVerifiedAt: null,
      },
    });

    // Log security event
    await securityEventService.emit({
      eventType: 'admin_action',
      payload: { action: 'mfa_disabled', userId },
      userId,
      severity: 'medium',
    });

    logger.info({ userId }, 'MFA disabled');
  }

  /**
   * Check if user has MFA enabled
   */
  async isMFAEnabled(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    return user?.mfaEnabled || false;
  }

  /**
   * Get remaining backup codes count
   */
  async getRemainingBackupCodes(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaBackupCodes: true },
    });

    return user?.mfaBackupCodes?.length || 0;
  }
}

// Export singleton instance
export const mfaService = new MFAService();
