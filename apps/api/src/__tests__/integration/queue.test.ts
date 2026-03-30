/**
 * Integration Tests for Job Queue System
 */

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Redis } from 'ioredis';
import {
    cancelJob,
    enqueueScan,
    getJobStatus,
    getQueueMetrics,
    healthCheck,
    initializeQueues,
    initializeWorker,
    ScanJobData,
    ScanJobResult,
    shutdownQueues
} from '../../lib/queue';

// Mock logger to avoid noise in tests
jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Job Queue Integration Tests', () => {
  let redis: Redis;
  const TEST_REDIS_URL = 'redis://localhost:6379/15'; // Use DB 15 for tests

  const testScanData: ScanJobData = {
    scanId: 'test-scan-123',
    userId: 'test-user-456',
    repositoryUrl: 'https://github.com/test/repo.git',
    branch: 'main',
    enableLLM: false,
    requestId: 'test-request-789',
  };

  beforeAll(async () => {
    // Connect to test Redis instance
    redis = new Redis(TEST_REDIS_URL);
    
    // Clear test database
    await redis.flushdb();
    
    // Initialize queues with test configuration
    await initializeQueues({
      concurrency: 1,
      retryAttempts: 2,
    });
  });

  afterAll(async () => {
    // Clean up and shutdown
    await shutdownQueues();
    await redis.quit();
  });

  describe('Queue Initialization', () => {
    it('should initialize queues successfully', async () => {
      const health = await healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.redis).toBe(true);
      expect(health.queue).toBe(true);
    });

    it('should provide queue metrics', async () => {
      const metrics = await getQueueMetrics();
      expect(metrics).toHaveProperty('waiting');
      expect(metrics).toHaveProperty('active');
      expect(metrics).toHaveProperty('completed');
      expect(metrics).toHaveProperty('failed');
      expect(metrics).toHaveProperty('delayed');
      expect(typeof metrics.waiting).toBe('number');
    });
  });

  describe('Job Lifecycle', () => {
    it('should enqueue a scan job', async () => {
      const jobId = await enqueueScan(testScanData);
      expect(jobId).toBe(testScanData.scanId);
    });

    it('should get job status', async () => {
      const status = await getJobStatus(testScanData.scanId);
      expect(status.id).toBe(testScanData.scanId);
      expect(['waiting', 'active']).toContain(status.status);
      expect(status.data).toMatchObject(testScanData as Record<string, unknown>);
    });

    it('should process job with worker', async () => {
      // Mock processor that simulates scan work
      const mockProcessor = jest.fn(async (job: { data: ScanJobData }) => {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
          success: true,
          scanId: job.data.scanId,
          verdict: 'pass',
          score: 85,
          metrics: {
            filesScanned: 10,
            linesScanned: 500,
            issuesFound: 2,
            criticalCount: 0,
            warningCount: 2,
            infoCount: 0,
          },
          findings: [
            {
              type: 'console_only',
              severity: 'warning',
              category: 'code_quality',
              file: 'src/test.ts',
              line: 10,
              title: 'Console-only function',
              message: 'Function contains only console.log',
              confidence: 0.9,
            },
          ],
        } as ScanJobResult;
      });

      // Initialize worker with mock processor
      await initializeWorker(mockProcessor, { concurrency: 1 });

      // Wait for job to complete
      let status = await getJobStatus(testScanData.scanId);
      let attempts = 0;
      while (status.status !== 'completed' && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        status = await getJobStatus(testScanData.scanId);
        attempts++;
      }

      expect(status.status).toBe('completed');
      expect(status.result).toBeDefined();
      expect(status.result?.success).toBe(true);
      expect(status.result?.verdict).toBe('pass');
      expect(status.result?.score).toBe(85);
      expect(mockProcessor).toHaveBeenCalledTimes(1);
    });

    it('should handle job cancellation', async () => {
      const cancelTestScan: ScanJobData = {
        ...testScanData,
        scanId: 'cancel-test-scan',
      };

      // Enqueue a job
      const jobId = await enqueueScan(cancelTestScan);
      expect(jobId).toBe('cancel-test-scan');

      // Cancel it immediately
      const cancelled = await cancelJob('cancel-test-scan');
      expect(cancelled).toBe(true);

      // Verify job is gone
      await expect(getJobStatus('cancel-test-scan')).rejects.toThrow('Job cancel-test-scan not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle processor failures gracefully', async () => {
      const failScanData: ScanJobData = {
        ...testScanData,
        scanId: 'fail-test-scan',
      };

      // Mock processor that throws an error
      const failingProcessor = jest.fn(async (_job: { data: ScanJobData }): Promise<ScanJobResult> => {
        throw new Error('Simulated scan failure');
      });

      // Initialize worker with failing processor
      await initializeWorker(failingProcessor, { concurrency: 1 });

      // Enqueue job that will fail
      await enqueueScan(failScanData);

      // Wait for job to fail
      let status = await getJobStatus(failScanData.scanId);
      let attempts = 0;
      while (status.status !== 'failed' && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        status = await getJobStatus(failScanData.scanId);
        attempts++;
      }

      expect(status.status).toBe('failed');
      expect(status.error).toBe('Simulated scan failure');
    });

    it('should retry failed jobs', async () => {
      const retryScanData: ScanJobData = {
        ...testScanData,
        scanId: 'retry-test-scan',
      };

      let attemptCount = 0;
      const retryProcessor = jest.fn(async (_job: { data: ScanJobData }): Promise<ScanJobResult> => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return {
          success: true,
          scanId: retryScanData.scanId,
          verdict: 'pass',
          score: 90,
        };
      });

      // Initialize worker with retry processor
      await initializeWorker(retryProcessor, { concurrency: 1 });

      // Enqueue job that will retry
      await enqueueScan(retryScanData);

      // Wait for job to complete after retries
      let status = await getJobStatus(retryScanData.scanId);
      let attempts = 0;
      while (status.status !== 'completed' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 500));
        status = await getJobStatus(retryScanData.scanId);
        attempts++;
      }

      expect(status.status).toBe('completed');
      expect(status.result?.success).toBe(true);
      expect(retryProcessor).toHaveBeenCalledTimes(3);
    });
  });

  describe('Health Checks', () => {
    it('should pass health check when all systems are operational', async () => {
      const health = await healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.redis).toBe(true);
      expect(health.queue).toBe(true);
      expect(health.worker).toBe(true);
      expect(health.metrics).toBeDefined();
    });

    it('should include queue metrics in health check', async () => {
      const health = await healthCheck();
      expect(health.metrics).toHaveProperty('waiting');
      expect(health.metrics).toHaveProperty('active');
      expect(health.metrics).toHaveProperty('completed');
      expect(health.metrics).toHaveProperty('failed');
    });
  });
});
