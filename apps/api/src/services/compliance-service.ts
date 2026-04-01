/**
 * Compliance Service
 * 
 * Handles GDPR, consent management, and legal acceptance functionality.
 */

import crypto from 'crypto';
import { z } from 'zod';
import { prisma as prismaClient } from '../db';
import { logger } from '../logger';

// Cast prisma to any to handle models that may not be in generated client yet
// These models exist in schema.prisma but client may need regeneration
const prisma = prismaClient as any;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ConsentPreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

export interface LegalAcceptanceInput {
  docType: 'terms' | 'privacy';
  version: string;
  ipHash?: string;
  userAgent?: string;
  locale?: string;
}

export interface GdprExportData {
  user: any;
  projects: unknown[];
  usageRecords: unknown[];
  subscriptions: unknown[];
  apiKeys: unknown[];
  auditLogs: unknown[];
  consentPreferences: any;
  legalAcceptances: unknown[];
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const consentPreferencesSchema = z.object({
  necessary: z.boolean().default(true),
  analytics: z.boolean().default(false),
  marketing: z.boolean().default(false),
  functional: z.boolean().default(false),
});

const legalAcceptanceSchema = z.object({
  docType: z.enum(['terms', 'privacy']),
  version: z.string().min(1),
  ipHash: z.string().optional(),
  userAgent: z.string().optional(),
  locale: z.string().optional(),
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Hash IP address for privacy compliance
 */
export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.IP_HASH_SALT || 'default-salt').digest('hex');
}

/**
 * Get current document versions from environment or config
 */
function getCurrentDocumentVersions(): { terms: string; privacy: string } {
  return {
    terms: process.env.TERMS_VERSION || '1.0',
    privacy: process.env.PRIVACY_VERSION || '1.0',
  };
}

// ============================================================================
// CONSENT MANAGEMENT
// ============================================================================

/**
 * Get user's consent preferences
 */
export async function getConsentPreferences(userId: string): Promise<ConsentPreferences | null> {
  try {
    const preferences = await prisma.consentPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      return null;
    }

    return {
      necessary: preferences.necessary,
      analytics: preferences.analytics,
      marketing: preferences.marketing,
      functional: preferences.functional,
    };
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get consent preferences');
    throw error;
  }
}

/**
 * Update user's consent preferences
 */
export async function updateConsentPreferences(
  userId: string,
  preferences: Partial<ConsentPreferences>,
  ip?: string
): Promise<ConsentPreferences> {
  try {
    const validated = consentPreferencesSchema.parse(preferences);
    const ipHash = ip ? hashIp(ip) : undefined;

    const result = await prisma.consentPreferences.upsert({
      where: { userId },
      update: {
        ...validated,
        ipHash,
        updatedAt: new Date(),
      },
      create: {
        userId,
        ...validated,
        ipHash,
      },
    });

    // Log consent change
    await logGdprAction(userId, 'consent_updated', {
      oldPreferences: await getConsentPreferences(userId),
      newPreferences: validated,
      ipHash,
    });

    return {
      necessary: result.necessary,
      analytics: result.analytics,
      marketing: result.marketing,
      functional: result.functional,
    };
  } catch (error) {
    logger.error({ error, userId }, 'Failed to update consent preferences');
    throw error;
  }
}

// ============================================================================
// LEGAL ACCEPTANCE
// ============================================================================

/**
 * Get user's legal acceptance status
 */
export async function getLegalAcceptanceStatus(userId: string) {
  try {
    const acceptances = await prisma.legalAcceptance.findMany({
      where: { userId },
      orderBy: { acceptedAt: 'desc' },
    });

    const currentVersions = getCurrentDocumentVersions();
    const status = {
      terms: {
        accepted: false,
        version: null,
        acceptedAt: null,
        currentVersion: currentVersions.terms,
        needsUpdate: false,
      },
      privacy: {
        accepted: false,
        version: null,
        acceptedAt: null,
        currentVersion: currentVersions.privacy,
        needsUpdate: false,
      },
    };

    for (const acceptance of acceptances) {
      if (acceptance.docType === 'terms') {
        status.terms.accepted = true;
        status.terms.version = acceptance.version;
        status.terms.acceptedAt = acceptance.acceptedAt;
        status.terms.needsUpdate = acceptance.version !== currentVersions.terms;
      } else if (acceptance.docType === 'privacy') {
        status.privacy.accepted = true;
        status.privacy.version = acceptance.version;
        status.privacy.acceptedAt = acceptance.acceptedAt;
        status.privacy.needsUpdate = acceptance.version !== currentVersions.privacy;
      }
    }

    return status;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get legal acceptance status');
    throw error;
  }
}

/**
 * Record legal document acceptance
 */
export async function acceptLegalDocument(
  userId: string,
  input: LegalAcceptanceInput,
  ip?: string
) {
  try {
    const validated = legalAcceptanceSchema.parse(input);
    const ipHash = ip ? hashIp(ip) : undefined;

    const acceptance = await prisma.legalAcceptance.upsert({
      where: { 
        userId_docType: { 
          userId, 
          docType: validated.docType 
        } 
      },
      update: {
        version: validated.version,
        acceptedAt: new Date(),
        ipHash,
        userAgent: validated.userAgent,
        locale: validated.locale,
      },
      create: {
        userId,
        docType: validated.docType,
        version: validated.version,
        ipHash,
        userAgent: validated.userAgent,
        locale: validated.locale,
      },
    });

    // Log acceptance
    await logGdprAction(userId, 'legal_accepted', {
      docType: validated.docType,
      version: validated.version,
      ipHash,
    });

    return acceptance;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to record legal acceptance');
    throw error;
  }
}

// ============================================================================
// GDPR EXPORT
// ============================================================================

/**
 * Create GDPR export job
 */
export async function createExportJob(userId: string): Promise<string> {
  try {
    // Check if there's already an active export job
    const existingJob = await prisma.gdprJob.findFirst({
      where: {
        userId,
        type: 'EXPORT',
        status: { in: ['pending', 'processing'] },
      },
    });

    if (existingJob) {
      throw new Error('Export job already in progress');
    }

    const job = await prisma.gdprJob.create({
      data: {
        userId,
        type: 'EXPORT',
        status: 'pending',
      },
    });

    // Start processing asynchronously
    processExportJob(job.id).catch(error => {
      logger.error({ error, jobId: job.id }, 'Export job processing failed');
    });

    return job.id;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to create export job');
    throw error;
  }
}

/**
 * Process GDPR export job
 */
async function processExportJob(jobId: string) {
  try {
    await prisma.gdprJob.update({
      where: { id: jobId },
      data: { status: 'processing', startedAt: new Date() },
    });

    const job = await prisma.gdprJob.findUnique({
      where: { id: jobId },
      include: { user: true },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    // Gather all user data
    const exportData = await assembleExportData(job.userId);

    // Create export file (in production, this would upload to S3/CloudStorage)
    const filename = `gdpr-export-${job.userId}-${Date.now()}.json`;
    const artifactPath = `/exports/${filename}`;
    
    // For now, store as JSON string in metadata (in production, use file storage)
    const metadata = {
      filename,
      data: JSON.stringify(exportData, null, 2),
      exportedAt: new Date().toISOString(),
    };

    await prisma.gdprJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        artifactPath,
        metadata,
      },
    });

    // Log export
    await logGdprAction(job.userId, 'data_exported', {
      jobId,
      filename,
      recordCount: Object.keys(exportData).length,
    });

  } catch (error) {
    await prisma.gdprJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    logger.error({ error, jobId }, 'Export job failed');
  }
}

/**
 * Assemble all user data for export
 */
export async function assembleExportData(userId: string): Promise<GdprExportData> {
  const [
    user,
    projects,
    usageRecords,
    subscriptions,
    apiKeys,
    auditLogs,
    consentPreferences,
    legalAcceptances,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
        isAgeConfirmed: true,
        ageConfirmedAt: true,
      },
    }),
    prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        description: true,
        path: true,
        repositoryUrl: true,
        fileCount: true,
        lineCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.usageRecord.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        count: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.subscription.findMany({
      where: { userId },
      select: {
        id: true,
        tier: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        createdAt: true,
      },
    }),
    prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    prisma.gdprAuditLog.findMany({
      where: { userId },
      select: {
        action: true,
        timestamp: true,
        metadata: true,
      },
    }),
    prisma.consentPreferences.findUnique({
      where: { userId },
      select: {
        necessary: true,
        analytics: true,
        marketing: true,
        functional: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.legalAcceptance.findMany({
      where: { userId },
      select: {
        docType: true,
        version: true,
        acceptedAt: true,
        locale: true,
      },
    }),
  ]);

  return {
    user,
    projects: projects || [],
    usageRecords: usageRecords || [],
    subscriptions: subscriptions || [],
    apiKeys: apiKeys || [],
    auditLogs: auditLogs || [],
    consentPreferences,
    legalAcceptances: legalAcceptances || [],
  };
}

/**
 * Get export job status and download link
 */
export async function getExportJobStatus(userId: string, jobId: string) {
  try {
    const job = await prisma.gdprJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    // If completed, generate download link
    let downloadUrl = null;
    if (job.status === 'completed' && job.metadata) {
      // In production, generate pre-signed URL for S3/CloudStorage
      downloadUrl = `/api/v1/gdpr/export/${jobId}/download`;
    }

    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failureReason: job.failureReason,
      downloadUrl,
    };
  } catch (error) {
    logger.error({ error, userId, jobId }, 'Failed to get export job status');
    throw error;
  }
}

// ============================================================================
// GDPR DELETION
// ============================================================================

/**
 * Create GDPR deletion job
 */
export async function createDeletionJob(userId: string): Promise<string> {
  try {
    // Check if there's already an active deletion job
    const existingJob = await prisma.gdprJob.findFirst({
      where: {
        userId,
        type: 'DELETE',
        status: { in: ['pending', 'processing'] },
      },
    });

    if (existingJob) {
      throw new Error('Deletion job already in progress');
    }

    const job = await prisma.gdprJob.create({
      data: {
        userId,
        type: 'DELETE',
        status: 'pending',
      },
    });

    // Start processing asynchronously
    processDeletionJob(job.id).catch(error => {
      logger.error({ error, jobId: job.id }, 'Deletion job processing failed');
    });

    return job.id;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to create deletion job');
    throw error;
  }
}

/**
 * Process GDPR deletion job
 */
async function processDeletionJob(jobId: string) {
  try {
    await prisma.gdprJob.update({
      where: { id: jobId },
      data: { status: 'processing', startedAt: new Date() },
    });

    const job = await prisma.gdprJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    // Perform deletion
    await deleteUserData(job.userId);

    await prisma.gdprJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    // Log deletion
    await logGdprAction(job.userId, 'account_deleted', {
      jobId,
      deletedAt: new Date().toISOString(),
    });

  } catch (error) {
    await prisma.gdprJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    logger.error({ error, jobId }, 'Deletion job failed');
  }
}

/**
 * Delete or anonymize user data
 */
export async function deleteUserData(userId: string) {
  // This is a critical operation - ensure we have proper logging
  logger.warn({ userId }, 'Starting GDPR data deletion');

  // Delete/anonymize in order of dependencies
  
  // 1. Delete user-owned data
  await prisma.project.deleteMany({ where: { userId } });
  await prisma.usageRecord.deleteMany({ where: { userId } });
  await prisma.apiKey.deleteMany({ where: { userId } });
  await prisma.refreshToken.deleteMany({ where: { userId } });
  await prisma.licenseKey.deleteMany({ where: { userId } });
  
  // 2. Delete compliance data
  await prisma.consentPreferences.delete({ where: { userId } });
  await prisma.legalAcceptance.deleteMany({ where: { userId } });
  await prisma.gdprJob.deleteMany({ where: { userId } });
  await prisma.gdprAuditLog.deleteMany({ where: { userId } });
  
  // 3. Handle subscriptions (keep for legal/tax purposes but anonymize)
  await prisma.subscription.updateMany({
    where: { userId },
    data: {
      // Keep subscription data for legal compliance but remove user reference
      userId: null, // This might not work due to foreign key, consider anonymization
    },
  });
  
  // 4. Finally delete the user
  await prisma.user.delete({ where: { id: userId } });

  logger.info({ userId }, 'GDPR data deletion completed');
}

/**
 * Get deletion job status
 */
export async function getDeletionJobStatus(userId: string, jobId: string) {
  try {
    const job = await prisma.gdprJob.findFirst({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    return {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failureReason: job.failureReason,
    };
  } catch (error) {
    logger.error({ error, userId, jobId }, 'Failed to get deletion job status');
    throw error;
  }
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log GDPR-related actions
 */
export async function logGdprAction(
  userId: string,
  action: string,
  metadata: any = null,
  actorUserId?: string
) {
  try {
    await prisma.gdprAuditLog.create({
      data: {
        userId,
        action,
        actorUserId,
        metadata,
      },
    });
  } catch (error) {
    logger.error({ error, userId, action }, 'Failed to log GDPR action');
  }
}

// ============================================================================
// AGE VERIFICATION
// ============================================================================

/**
 * Confirm user age
 */
export async function confirmAge(userId: string, age: number): Promise<void> {
  try {
    // Basic age validation - require at least 16 (GDPR compliant)
    if (age < 16) {
      throw new Error('Age verification failed: User must be at least 16 years old');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        isAgeConfirmed: true,
        ageConfirmedAt: new Date(),
      },
    });

    await logGdprAction(userId, 'age_confirmed', { age });
  } catch (error) {
    logger.error({ error, userId, age }, 'Failed to confirm age');
    throw error;
  }
}

/**
 * Check if user has confirmed age
 */
export async function checkAgeConfirmation(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAgeConfirmed: true },
    });

    return user?.isAgeConfirmed || false;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to check age confirmation');
    return false;
  }
}
