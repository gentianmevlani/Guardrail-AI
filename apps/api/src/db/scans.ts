/**
 * Scans Data Access Layer
 * 
 * Typed database operations for scans and findings
 */

import type { Prisma } from '@prisma/client';
import { prisma } from './index';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateScanData {
  userId: string;
  repositoryId?: string | null;
  projectPath?: string | null;
  branch?: string;
  commitSha?: string | null;
}

export interface UpdateScanData {
  status?: string;
  progress?: number;
  verdict?: string | null;
  score?: number | null;
  filesScanned?: number;
  linesScanned?: number;
  issuesFound?: number;
  criticalCount?: number;
  warningCount?: number;
  infoCount?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  durationMs?: number | null;
  error?: string | null;
}

export interface CreateFindingData {
  scanId: string;
  type: string;
  severity: string;
  category: string;
  file: string;
  line: number;
  column?: number | null;
  endLine?: number | null;
  endColumn?: number | null;
  title: string;
  message: string;
  codeSnippet?: string | null;
  suggestion?: string | null;
  confidence?: number;
  aiExplanation?: string | null;
  aiGenerated?: boolean;
  status?: string;
  ruleId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface ScanFilters {
  status?: string;
  verdict?: string;
  limit?: number;
  offset?: number;
}

export interface FindingFilters {
  severity?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// REPOSITORIES
// ============================================================================

export async function getRepositoryById(id: string, userId: string) {
  return prisma.repository.findFirst({
    where: {
      id,
      userId,
    },
    select: {
      id: true,
      fullName: true,
      cloneUrl: true,
      name: true,
      description: true,
      isPrivate: true,
      language: true,
    },
  });
}

// ============================================================================
// SCANS
// ============================================================================

export async function createScan(data: CreateScanData) {
  return prisma.scan.create({
    data: {
      userId: data.userId,
      repositoryId: data.repositoryId,
      projectPath: data.projectPath,
      branch: data.branch || 'main',
      commitSha: data.commitSha || null,
    },
    include: {
      findings: true,
    },
  });
}

export async function getScanById(id: string, userId?: string) {
  return prisma.scan.findFirst({
    where: {
      id,
      ...(userId && { userId }),
    },
    include: {
      findings: {
        orderBy: [
          { severity: 'asc' },
          { file: 'asc' },
          { line: 'asc' },
        ],
      },
    },
  });
}

export async function getScansByUserId(userId: string, filters: ScanFilters = {}) {
  const { status, verdict, limit = 20, offset = 0 } = filters;
  
  const where: any = { userId };
  if (status && status !== 'all') where.status = status;
  if (verdict && verdict !== 'all') where.verdict = verdict;

  const [scans, total] = await Promise.all([
    prisma.scan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.scan.count({ where }),
  ]);

  return { scans, total };
}

export async function updateScan(id: string, data: UpdateScanData) {
  return prisma.scan.update({
    where: { id },
    data,
  });
}

export async function deleteScan(id: string, userId?: string) {
  return prisma.scan.deleteMany({
    where: {
      id,
      ...(userId && { userId }),
    },
  });
}

export async function getScanFindingsSummary(scanId: string) {
  return prisma.finding.groupBy({
    by: ['severity'],
    where: { scanId },
    _count: { severity: true },
  });
}

// ============================================================================
// FINDINGS
// ============================================================================

export async function createFinding(data: CreateFindingData) {
  return prisma.finding.create({
    data,
  });
}

export async function createFindingsBatch(data: CreateFindingData[]) {
  return prisma.finding.createMany({
    data,
    skipDuplicates: true,
  });
}

export async function getFindingsByScanId(
  scanId: string, 
  filters: FindingFilters = {}
) {
  const { severity, type, limit = 50, offset = 0 } = filters;
  
  const where: any = { scanId };
  if (severity && severity !== 'all') where.severity = severity;
  if (type) where.type = type;

  const [findings, total] = await Promise.all([
    prisma.finding.findMany({
      where,
      orderBy: [
        { severity: 'asc' },
        { file: 'asc' },
        { line: 'asc' },
      ],
      take: limit,
      skip: offset,
    }),
    prisma.finding.count({ where }),
  ]);

  return { findings, total };
}

export async function getFindingById(id: string, scanId?: string) {
  return prisma.finding.findFirst({
    where: {
      id,
      ...(scanId && { scanId }),
    },
  });
}

export async function updateFinding(
  id: string, 
  data: Omit<CreateFindingData, 'scanId'>
) {
  return prisma.finding.update({
    where: { id },
    data,
  });
}

export async function updateFindingExplanation(
  id: string, 
  aiExplanation: string
) {
  return prisma.finding.update({
    where: { id },
    data: {
      aiExplanation,
      aiGenerated: true,
    },
  });
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function createScanWithFindings(
  scanData: CreateScanData,
  findingsData: CreateFindingData[]
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Create scan first
    const scan = await tx.scan.create({
      data: scanData,
    });

    // Then create all findings
    if (findingsData.length > 0) {
      await tx.finding.createMany({
        data: findingsData.map(f => ({ ...f, scanId: scan.id })),
        skipDuplicates: true,
      });
    }

    return scan;
  });
}

export async function completeScan(
  scanId: string,
  results: {
    verdict: string;
    score: number;
    filesScanned: number;
    linesScanned: number;
    issuesFound: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    durationMs: number;
    findings: CreateFindingData[];
  }
) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Update scan with results
    const scan = await tx.scan.update({
      where: { id: scanId },
      data: {
        status: 'completed',
        progress: 100,
        verdict: results.verdict,
        score: results.score,
        filesScanned: results.filesScanned,
        linesScanned: results.linesScanned,
        issuesFound: results.issuesFound,
        criticalCount: results.criticalCount,
        warningCount: results.warningCount,
        infoCount: results.infoCount,
        completedAt: new Date(),
        durationMs: results.durationMs,
      },
    });

    // Create findings
    if (results.findings.length > 0) {
      await tx.finding.createMany({
        data: results.findings.map(f => ({ ...f, scanId })),
        skipDuplicates: true,
      });
    }

    return scan;
  });
}

// Alias for backward compatibility
export const completeScanWithFindings = completeScan;

export async function failScan(
  scanId: string,
  error: string,
  durationMs: number
) {
  return prisma.scan.update({
    where: { id: scanId },
    data: {
      status: 'failed',
      progress: 0,
      error,
      completedAt: new Date(),
      durationMs,
    },
  });
}
