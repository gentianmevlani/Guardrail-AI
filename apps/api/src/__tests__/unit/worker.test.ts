/**
 * Unit Tests for Job Processing Logic
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Job } from 'bullmq';
import { processScanJob } from '../../worker';
import { ScanJobData, ScanJobResult } from '../../lib/queue';

// Mock dependencies
jest.mock('@guardrail/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../src/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
  },
}));

const mockPool = require('@guardrail/database').pool;

describe('Job Processing Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('processScanJob', () => {
    const mockJobData: ScanJobData = {
      scanId: 'test-scan-123',
      userId: 'test-user-456',
      repositoryUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      enableLLM: false,
      requestId: 'test-request-789',
    };

    const mockJob = {
      data: mockJobData,
      id: 'job-123',
    } as Job<ScanJobData>;

    it('should process a successful scan job', async () => {
      // Mock database queries for successful scan
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // Initial status update
        .mockResolvedValueOnce({ rows: [] }) // Progress updates
        .mockResolvedValueOnce({ rows: [] }) // Findings storage
        .mockResolvedValueOnce({ rows: [] }); // Final results update

      const result = await processScanJob(mockJob);

      expect(result.success).toBe(true);
      expect(result.scanId).toBe(mockJobData.scanId);
      expect(result.verdict).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.findings).toBeDefined();
      expect(result.findings?.length).toBeGreaterThan(0);

      // Verify database calls
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scans SET status = $1'),
        ['running', 10, mockJobData.scanId]
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO findings'),
        expect.any(Array)
      );
    });

    it('should handle scan job failure', async () => {
      // Mock database failure
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const result = await processScanJob(mockJob);

      expect(result.success).toBe(false);
      expect(result.scanId).toBe(mockJobData.scanId);
      expect(result.error).toBe('Database connection failed');
      expect(result.errorDetails).toBeDefined();

      // Verify error was logged
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scans SET status = $1'),
        ['failed', 0, 'Database connection failed', mockJobData.scanId]
      );
    });

    it('should update scan progress during processing', async () => {
      const progressUpdates: Array<[string, number]> = [];
      
      // Mock database to capture progress updates
      mockPool.query.mockImplementation((query: string, params: any[]) => {
        if (query.includes('UPDATE scans SET status = $1') && params[1] !== 0) {
          progressUpdates.push([params[0], params[1]]);
        }
        return Promise.resolve({ rows: [] });
      });

      await processScanJob(mockJob);

      // Verify progress was updated multiple times
      expect(progressUpdates.length).toBeGreaterThan(1);
      expect(progressUpdates[0]).toEqual(['running', 10]);
      expect(progressUpdates[progressUpdates.length - 1]).toEqual(['completed', 100]);
    });

    it('should store findings correctly', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await processScanJob(mockJob);

      expect(result.success).toBe(true);
      expect(result.findings).toBeDefined();

      // Verify findings were inserted
      const findingInserts = mockPool.query.mock.calls.filter(call => 
        call[0].includes('INSERT INTO findings')
      );
      expect(findingInserts.length).toBeGreaterThan(0);

      // Check finding structure
      const insertCall = findingInserts[0];
      expect(insertCall[1]).toHaveLength(17); // Number of columns in findings table
      expect(insertCall[1][0]).toBe(mockJobData.scanId); // scan_id
    });

    it('should calculate verdict and score correctly', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await processScanJob(mockJob);

      expect(result.success).toBe(true);
      expect(result.verdict).toMatch(/^(pass|review|fail)$/);
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle LLM-enabled scans', async () => {
      const llmJobData: ScanJobData = {
        ...mockJobData,
        enableLLM: true,
        llmConfig: {
          provider: 'openai',
          apiKey: 'test-api-key',
        },
      };

      const llmMockJob = {
        data: llmJobData,
        id: 'llm-job-123',
      } as Job<ScanJobData>;

      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await processScanJob(llmMockJob);

      expect(result.success).toBe(true);
      // The mock scan service should handle LLM config appropriately
      expect(result.findings).toBeDefined();
    });

    it('should handle repository URL scanning', async () => {
      const repoJobData: ScanJobData = {
        ...mockJobData,
        repositoryUrl: 'https://github.com/example/user-repo.git',
      };

      const repoMockJob = {
        data: repoJobData,
        id: 'repo-job-123',
      } as Job<ScanJobData>;

      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await processScanJob(repoMockJob);

      expect(result.success).toBe(true);
      expect(result.scanId).toBe(repoJobData.scanId);
    });

    it('should handle local path scanning', async () => {
      const localJobData: ScanJobData = {
        ...mockJobData,
        repositoryUrl: undefined,
        localPath: '/path/to/local/project',
      };

      const localMockJob = {
        data: localJobData,
        id: 'local-job-123',
      } as Job<ScanJobData>;

      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await processScanJob(localMockJob);

      expect(result.success).toBe(true);
      expect(result.scanId).toBe(localJobData.scanId);
    });

    it('should include proper metadata in results', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await processScanJob(mockJob);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.metrics).toMatchObject({
        filesScanned: expect.any(Number),
        linesScanned: expect.any(Number),
        issuesFound: expect.any(Number),
        criticalCount: expect.any(Number),
        warningCount: expect.any(Number),
        infoCount: expect.any(Number),
      });

      expect(result.findings).toBeDefined();
      if (result.findings && result.findings.length > 0) {
        const finding = result.findings[0];
        expect(finding).toMatchObject({
          type: expect.any(String),
          severity: expect.any(String),
          category: expect.any(String),
          file: expect.any(String),
          line: expect.any(Number),
          title: expect.any(String),
          message: expect.any(String),
          confidence: expect.any(Number),
        });
      }
    });

    it('should handle branch specification', async () => {
      const branchJobData: ScanJobData = {
        ...mockJobData,
        branch: 'develop',
      };

      const branchMockJob = {
        data: branchJobData,
        id: 'branch-job-123',
      } as Job<ScanJobData>;

      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await processScanJob(branchMockJob);

      expect(result.success).toBe(true);
      expect(result.scanId).toBe(branchJobData.scanId);
    });

    it('should correlate logs with requestId', async () => {
      const requestJobData: ScanJobData = {
        ...mockJobData,
        requestId: 'correlation-test-123',
      };

      const requestMockJob = {
        data: requestJobData,
        id: 'request-job-123',
      } as Job<ScanJobData>;

      mockPool.query.mockResolvedValue({ rows: [] });

      await processScanJob(requestMockJob);

      // Verify that child logger was called with requestId
      const { logger } = require('../src/logger');
      expect(logger.child).toHaveBeenCalledWith({
        scanId: requestJobData.scanId,
        userId: requestJobData.userId,
        requestId: requestJobData.requestId,
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing repository information', async () => {
      const invalidJobData: ScanJobData = {
        scanId: 'invalid-scan',
        userId: 'test-user',
        branch: 'main',
      };

      const invalidMockJob = {
        data: invalidJobData,
        id: 'invalid-job',
      } as Job<ScanJobData>;

      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await processScanJob(invalidMockJob);

      expect(result.success).toBe(true); // Mock scan service handles this gracefully
      expect(result.scanId).toBe(invalidJobData.scanId);
    });

    it('should handle database timeout', async () => {
      const mockJob = {
        data: {
          scanId: 'timeout-scan',
          userId: 'test-user',
          branch: 'main',
        },
        id: 'timeout-job',
      } as Job<ScanJobData>;

      // Mock database timeout
      mockPool.query.mockRejectedValue(new Error('Connection timeout'));

      const result = await processScanJob(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
      expect(result.errorDetails?.stack).toBeDefined();
    });
  });
});
