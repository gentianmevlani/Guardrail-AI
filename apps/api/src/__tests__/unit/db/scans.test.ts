/**
 * Unit Tests for Scans DAL
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../db';
import * as scansDAL from '../../../db/scans';

// Mock Prisma
vi.mock('../../../db', () => ({
  prisma: {
    scan: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    finding: {
      create: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    repository: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('Scans DAL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createScan', () => {
    it('should create a scan with provided data', async () => {
      const mockScan = {
        id: 'scan-1',
        userId: 'user-1',
        repositoryId: 'repo-1',
        projectPath: '/path/to/project',
        branch: 'main',
        status: 'queued',
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.scan.create).mockResolvedValue(mockScan as any);

      const result = await scansDAL.createScan({
        userId: 'user-1',
        repositoryId: 'repo-1',
        projectPath: '/path/to/project',
        branch: 'main',
      });

      expect(prisma.scan.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          repositoryId: 'repo-1',
          projectPath: '/path/to/project',
          branch: 'main',
          commitSha: null,
        },
        include: {
          findings: true,
        },
      });
      expect(result).toEqual(mockScan);
    });
  });

  describe('getScanById', () => {
    it('should return scan with findings when found', async () => {
      const mockScan = {
        id: 'scan-1',
        userId: 'user-1',
        status: 'completed',
        findings: [
          { id: 'finding-1', type: 'error', severity: 'critical' },
        ],
      };

      vi.mocked(prisma.scan.findFirst).mockResolvedValue(mockScan as any);

      const result = await scansDAL.getScanById('scan-1');

      expect(prisma.scan.findFirst).toHaveBeenCalledWith({
        where: { id: 'scan-1' },
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
      expect(result).toEqual(mockScan);
    });

    it('should return null when scan not found', async () => {
      vi.mocked(prisma.scan.findFirst).mockResolvedValue(null);

      const result = await scansDAL.getScanById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getScansByUserId', () => {
    it('should return paginated scans for user', async () => {
      const mockScans = [
        { id: 'scan-1', userId: 'user-1', status: 'completed' },
        { id: 'scan-2', userId: 'user-1', status: 'running' },
      ];

      vi.mocked(prisma.scan.findMany).mockResolvedValue(mockScans);
      vi.mocked(prisma.scan.count).mockResolvedValue(2);

      const result = await scansDAL.getScansByUserId('user-1', {
        status: 'completed',
        limit: 10,
        offset: 0,
      });

      expect(prisma.scan.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });
      expect(prisma.scan.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'completed' },
      });
      expect(result).toEqual({
        scans: mockScans,
        total: 2,
      });
    });
  });

  describe('completeScanWithFindings', () => {
    it('should complete scan and create findings in transaction', async () => {
      const mockScan = {
        id: 'scan-1',
        status: 'completed',
        verdict: 'pass',
        score: 85,
      };

      const findings = [
        {
          type: 'error',
          severity: 'critical',
          category: 'security',
          file: 'app.js',
          line: 10,
          title: 'Security Issue',
          message: 'Potential vulnerability',
          confidence: 0.9,
        },
      ];

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return await callback({
          scan: {
            update: vi.fn().mockResolvedValue(mockScan),
          },
          finding: {
            createMany: vi.fn(),
          },
        });
      });

      const result = await scansDAL.completeScanWithFindings('scan-1', {
        verdict: 'pass',
        score: 85,
        filesScanned: 10,
        linesScanned: 100,
        issuesFound: 1,
        criticalCount: 1,
        warningCount: 0,
        infoCount: 0,
        durationMs: 5000,
        findings,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockScan);
    });
  });

  describe('getRepositoryById', () => {
    it('should return repository when found', async () => {
      const mockRepo = {
        id: 'repo-1',
        fullName: 'user/project',
        cloneUrl: 'https://github.com/user/project.git',
        name: 'project',
        description: 'Test project',
        isPrivate: false,
        language: 'JavaScript',
      };

      vi.mocked(prisma.repository.findFirst).mockResolvedValue(mockRepo);

      const result = await scansDAL.getRepositoryById('repo-1', 'user-1');

      expect(prisma.repository.findFirst).toHaveBeenCalledWith({
        where: { id: 'repo-1', userId: 'user-1' },
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
      expect(result).toEqual(mockRepo);
    });

    it('should return null when repository not found', async () => {
      vi.mocked(prisma.repository.findFirst).mockResolvedValue(null);

      const result = await scansDAL.getRepositoryById('nonexistent', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('createFindingsBatch', () => {
    it('should create multiple findings', async () => {
      const findings = [
        {
          scanId: 'scan-1',
          type: 'error',
          severity: 'critical',
          category: 'security',
          file: 'app.js',
          line: 10,
          title: 'Security Issue',
          message: 'Potential vulnerability',
          confidence: 0.9,
        },
        {
          scanId: 'scan-1',
          type: 'warning',
          severity: 'warning',
          category: 'performance',
          file: 'utils.js',
          line: 20,
          title: 'Performance Issue',
          message: 'Inefficient code',
          confidence: 0.7,
        },
      ];

      vi.mocked(prisma.finding.createMany).mockResolvedValue({ count: 2 });

      const result = await scansDAL.createFindingsBatch(findings);

      expect(prisma.finding.createMany).toHaveBeenCalledWith({
        data: findings,
        skipDuplicates: true,
      });
      expect(result).toEqual({ count: 2 });
    });
  });

  describe('updateFindingExplanation', () => {
    it('should update finding with AI explanation', async () => {
      const mockFinding = {
        id: 'finding-1',
        aiExplanation: 'This is an AI-generated explanation',
        aiGenerated: true,
      };

      vi.mocked(prisma.finding.update).mockResolvedValue(mockFinding);

      const result = await scansDAL.updateFindingExplanation(
        'finding-1',
        'This is an AI-generated explanation'
      );

      expect(prisma.finding.update).toHaveBeenCalledWith({
        where: { id: 'finding-1' },
        data: {
          aiExplanation: 'This is an AI-generated explanation',
          aiGenerated: true,
        },
      });
      expect(result).toEqual(mockFinding);
    });
  });

  describe('failScan', () => {
    it('should update scan status to failed', async () => {
      const mockScan = {
        id: 'scan-1',
        status: 'failed',
        error: 'Scan failed due to error',
        durationMs: 3000,
      };

      vi.mocked(prisma.scan.update).mockResolvedValue(mockScan);

      const result = await scansDAL.failScan('scan-1', 'Scan failed due to error', 3000);

      expect(prisma.scan.update).toHaveBeenCalledWith({
        where: { id: 'scan-1' },
        data: {
          status: 'failed',
          progress: 0,
          error: 'Scan failed due to error',
          completedAt: expect.any(Date),
          durationMs: 3000,
        },
      });
      expect(result).toEqual(mockScan);
    });
  });
});
