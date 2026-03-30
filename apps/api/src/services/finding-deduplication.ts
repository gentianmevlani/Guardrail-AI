/**
 * Finding Deduplication Service
 * 
 * Groups identical findings across scans to reduce noise and improve signal.
 * Findings are deduplicated based on file, line, type, and message content.
 */

import { prisma } from '@guardrail/database';
import crypto from 'crypto';
import { logger } from '../logger';

export interface DeduplicationResult {
  totalFindings: number;
  uniqueFindings: number;
  duplicatesRemoved: number;
  groupsCreated: number;
}

/**
 * Generate deduplication key for a finding
 */
export function generateDeduplicationKey(finding: {
  file: string;
  line: number;
  type: string;
  message: string;
}): string {
  // Normalize file path (remove leading ./ and normalize separators)
  const normalizedFile = finding.file
    .replace(/^\.\//, '')
    .replace(/\\/g, '/')
    .toLowerCase();

  // Normalize message (remove whitespace variations)
  const normalizedMessage = finding.message
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const data = `${normalizedFile}:${finding.line}:${finding.type}:${normalizedMessage}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Deduplicate findings for a scan
 */
export async function deduplicateFindingsForScan(
  scanId: string,
): Promise<DeduplicationResult> {
  const startTime = Date.now();

  // Get all findings for this scan
  const findings = await prisma.finding.findMany({
    where: { scanId },
    orderBy: { createdAt: 'asc' }, // Keep earliest finding as primary
  });

  if (findings.length === 0) {
    return {
      totalFindings: 0,
      uniqueFindings: 0,
      duplicatesRemoved: 0,
      groupsCreated: 0,
    };
  }

  // Group findings by deduplication key
  const groups = new Map<string, typeof findings>();

  for (const finding of findings) {
    const key = generateDeduplicationKey({
      file: finding.file,
      line: finding.line,
      type: finding.type,
      message: finding.message,
    });

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(finding);
  }

  let duplicatesRemoved = 0;
  let groupsCreated = 0;

  // Process each group
  for (const [key, group] of groups) {
    if (group.length === 1) {
      // Single finding, just update the key
      await prisma.finding.update({
        where: { id: group[0].id },
        data: {
          deduplicationKey: key,
          occurrenceCount: 1,
          firstSeenAt: group[0].createdAt,
          lastSeenAt: group[0].createdAt,
        },
      });
      continue;
    }

    // Multiple findings - keep first, merge others
    const primary = group[0];
    const duplicates = group.slice(1);

    // Calculate occurrence count (including this scan)
    const occurrenceCount = group.length;

    // Update primary finding
    await prisma.finding.update({
      where: { id: primary.id },
      data: {
        deduplicationKey: key,
        occurrenceCount,
        firstSeenAt: primary.createdAt,
        lastSeenAt: new Date(), // Update to most recent
        // Merge metadata if present
        metadata: {
          ...(primary.metadata as object || {}),
          deduplicated: true,
          duplicateCount: duplicates.length,
        },
      },
    });

    // Delete duplicate findings
    await prisma.finding.deleteMany({
      where: {
        id: { in: duplicates.map((f: { id: string }) => f.id) },
      },
    });

    duplicatesRemoved += duplicates.length;
    groupsCreated++;
  }

  const duration = Date.now() - startTime;
  logger.info(
    {
      scanId,
      totalFindings: findings.length,
      uniqueFindings: groups.size,
      duplicatesRemoved,
      groupsCreated,
      durationMs: duration,
    },
    'Finding deduplication completed',
  );

  return {
    totalFindings: findings.length,
    uniqueFindings: groups.size,
    duplicatesRemoved,
    groupsCreated,
  };
}

/**
 * Deduplicate findings across all scans for a user
 * Useful for finding trends and reducing overall noise
 */
export async function deduplicateFindingsForUser(
  userId: string,
): Promise<DeduplicationResult> {
  // Get all open findings for user
  const findings = await prisma.finding.findMany({
    where: {
      scan: { userId },
      status: 'open', // Only deduplicate open findings
    },
    include: { scan: true },
    orderBy: { createdAt: 'asc' },
  });

  if (findings.length === 0) {
    return {
      totalFindings: 0,
      uniqueFindings: 0,
      duplicatesRemoved: 0,
      groupsCreated: 0,
    };
  }

  // Group by deduplication key
  const groups = new Map<string, typeof findings>();

  for (const finding of findings) {
    const key = generateDeduplicationKey({
      file: finding.file,
      line: finding.line,
      type: finding.type,
      message: finding.message,
    });

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(finding);
  }

  let duplicatesRemoved = 0;
  let groupsCreated = 0;

  // Process groups
  for (const [key, group] of groups) {
    if (group.length === 1) {
      // Update single finding
      await prisma.finding.update({
        where: { id: group[0].id },
        data: {
          deduplicationKey: key,
          occurrenceCount: 1,
          firstSeenAt: group[0].createdAt,
          lastSeenAt: group[0].createdAt,
        },
      });
      continue;
    }

    // Keep the earliest finding, mark others as duplicates
    const primary = group[0];
    const duplicates = group.slice(1);

    // Find earliest and latest seen dates
    const dates = group
      .map((f: { createdAt: Date }) => f.createdAt)
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());
    const firstSeen = dates[0];
    const lastSeen = dates[dates.length - 1];

    // Update primary
    await prisma.finding.update({
      where: { id: primary.id },
      data: {
        deduplicationKey: key,
        occurrenceCount: group.length,
        firstSeenAt: firstSeen,
        lastSeenAt: lastSeen,
        metadata: {
          ...(primary.metadata as object || {}),
          deduplicated: true,
          duplicateCount: duplicates.length,
          scanIds: group.map((f: { scanId: string }) => f.scanId),
        },
      },
    });

    // Mark duplicates as suppressed (don't delete, keep for history)
    await prisma.finding.updateMany({
      where: {
        id: { in: duplicates.map((f: { id: string }) => f.id) },
      },
      data: {
        status: 'suppressed',
        metadata: {
          deduplicated: true,
          primaryFindingId: primary.id,
        },
      },
    });

    duplicatesRemoved += duplicates.length;
    groupsCreated++;
  }

  logger.info(
    {
      userId,
      totalFindings: findings.length,
      uniqueFindings: groups.size,
      duplicatesRemoved,
      groupsCreated,
    },
    'User finding deduplication completed',
  );

  return {
    totalFindings: findings.length,
    uniqueFindings: groups.size,
    duplicatesRemoved,
    groupsCreated,
  };
}
