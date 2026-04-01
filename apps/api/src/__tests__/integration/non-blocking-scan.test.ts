/**
 * Test for Non-Blocking Scan Submission
 * 
 * This test verifies that scan submission does not block the request thread
 * and returns immediately while processing happens in the background.
 */

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import fastify, { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { initializeQueues, initializeWorker, shutdownQueues, ScanJobData, ScanJobResult } from '../../lib/queue';

// Mock dependencies
jest.mock('@guardrail/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../logger', () => ({
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

describe('Non-Blocking Scan Submission', () => {
  let server: FastifyInstance;
  let baseUrl: string;

  beforeAll(async () => {
    // Initialize test queues
    await initializeQueues({
      concurrency: 1,
      retryAttempts: 1,
    });

    // Initialize worker with slow processor to test non-blocking behavior
    const slowProcessor = jest.fn(async (job: { data: ScanJobData }): Promise<ScanJobResult> => {
      // Simulate a slow scan that takes 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

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
        findings: [],
      };
    });

    await initializeWorker(slowProcessor);

    // Mock database responses
    mockPool.query.mockResolvedValue({ rows: [] });

    // Create test server
    server = fastify();
    
    // Add auth middleware mock
    server.addHook('preHandler', async (request, reply) => {
      (request as any).user = { id: 'test-user-123', email: 'test@example.com' };
    });

    // Register scan routes
    const { scanRoutes } = await import('../../routes/scans');
    server.register(scanRoutes, { prefix: '/api/v1/scans' });

    // Start server
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    if (!address) {
      throw new Error('Test server address unavailable');
    }
    if (typeof address === 'string') {
      baseUrl = `http://${address}`;
    } else {
      baseUrl = `http://127.0.0.1:${address.port}`;
    }
  });

  afterAll(async () => {
    await server.close();
    await shutdownQueues();
  });

  it('should submit scan and return immediately without blocking', async () => {
    const startTime = Date.now();
    
    // Submit scan request
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/scans',
      payload: {
        repositoryUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        enableLLM: false,
      },
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    const submissionTime = Date.now() - startTime;

    // Verify response is immediate (should be much less than 2 seconds)
    expect(submissionTime).toBeLessThan(500); // Should return within 500ms
    expect(response.statusCode).toBe(201);
    
    const responseBody = JSON.parse(response.payload);
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.scanId).toBeDefined();
    expect(responseBody.data.jobId).toBeDefined();
    expect(responseBody.data.status).toBe('queued');
    expect(responseBody.data.message).toBe('Scan enqueued successfully');

    const scanId = responseBody.data.scanId;
  });

  it('should allow concurrent scan submissions', async () => {
    const concurrentRequests = 5;
    const submissionPromises: Promise<LightMyRequestResponse>[] = [];
    const submissionTimes: number[] = [];

    // Submit multiple scans concurrently
    for (let i = 0; i < concurrentRequests; i++) {
      const startTime = Date.now();
      
      const promise = server.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          repositoryUrl: `https://github.com/test/repo-${i}.git`,
          branch: 'main',
          enableLLM: false,
        },
        headers: {
          authorization: 'Bearer test-token',
        },
      }).then(response => {
        const submissionTime = Date.now() - startTime;
        submissionTimes.push(submissionTime);
        return response;
      });

      submissionPromises.push(promise);
    }

    // Wait for all submissions to complete
    const responses = await Promise.all(submissionPromises);

    // Verify all submissions succeeded quickly
    expect(responses).toHaveLength(concurrentRequests);
    responses.forEach(response => {
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('queued');
    });

    // Verify all submissions completed quickly (none should take 2+ seconds)
    submissionTimes.forEach(time => {
      expect(time).toBeLessThan(500);
    });

    // Average submission time should be low
    const avgTime = submissionTimes.reduce((a, b) => a + b, 0) / submissionTimes.length;
    expect(avgTime).toBeLessThan(200);
  });

  it('should handle scan status polling while processing', async () => {
    // Submit a scan
    const submitResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/scans',
      payload: {
        repositoryUrl: 'https://github.com/test/status-test.git',
        branch: 'main',
        enableLLM: false,
      },
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(submitResponse.statusCode).toBe(201);
    const submitBody = JSON.parse(submitResponse.payload);
    const scanId = submitBody.data.scanId;

    // Poll status while processing
    let finalStatus = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts && finalStatus !== 'completed') {
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait 300ms
      
      const statusResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/scans/${scanId}/status`,
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      expect(statusResponse.statusCode).toBe(200);
      const statusBody = JSON.parse(statusResponse.payload);
      expect(statusBody.success).toBe(true);
      expect(statusBody.data.jobId).toBe(scanId);
      expect(['queued', 'running', 'completed']).toContain(statusBody.data.status);

      finalStatus = statusBody.data.status;
      attempts++;
    }

    // Should eventually complete
    expect(finalStatus).toBe('completed');
  });

  it('should allow scan cancellation during processing', async () => {
    // Submit a scan
    const submitResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/scans',
      payload: {
        repositoryUrl: 'https://github.com/test/cancel-test.git',
        branch: 'main',
        enableLLM: false,
      },
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(submitResponse.statusCode).toBe(201);
    const submitBody = JSON.parse(submitResponse.payload);
    const scanId = submitBody.data.scanId;

    // Wait a bit for job to start
    await new Promise(resolve => setTimeout(resolve, 100));

    // Cancel the scan
    const cancelResponse = await server.inject({
      method: 'POST',
      url: `/api/v1/scans/${scanId}/cancel`,
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(cancelResponse.statusCode).toBe(200);
    const cancelBody = JSON.parse(cancelResponse.payload);
    expect(cancelBody.success).toBe(true);
    expect(cancelBody.data.cancelled).toBe(true);
  });

  it('should maintain request thread responsiveness', async () => {
    // Test that the server can handle other requests while scans are processing
    
    // Submit multiple slow scans
    const scanPromises: Promise<LightMyRequestResponse>[] = [];
    for (let i = 0; i < 3; i++) {
      scanPromises.push(
        server.inject({
          method: 'POST',
          url: '/api/v1/scans',
          payload: {
            repositoryUrl: `https://github.com/test/load-test-${i}.git`,
            branch: 'main',
            enableLLM: false,
          },
          headers: {
            authorization: 'Bearer test-token',
          },
        })
      );
    }

    // Start scan submissions
    const scanSubmissions = Promise.all(scanPromises);

    // While scans are submitting and processing, make other requests
    const otherRequests = [];
    for (let i = 0; i < 10; i++) {
      otherRequests.push(
        server.inject({
          method: 'GET',
          url: '/health',
        })
      );
    }

    // Wait for all other requests to complete
    const otherResponses = await Promise.all(otherRequests);

    // Verify other requests completed quickly
    otherResponses.forEach(response => {
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('ok');
    });

    // Wait for scan submissions to complete
    const scanResponses = await scanSubmissions;
    
    // Verify all scans were submitted successfully
    scanResponses.forEach(response => {
      expect(response.statusCode).toBe(201);
    });
  });

  it('should handle scan submission with various configurations', async () => {
    const testCases = [
      {
        name: 'Repository URL only',
        payload: {
          repositoryUrl: 'https://github.com/test/repo-only.git',
        },
      },
      {
        name: 'Local path only',
        payload: {
          localPath: '/path/to/local/project',
        },
      },
      {
        name: 'With LLM enabled',
        payload: {
          repositoryUrl: 'https://github.com/test/llm-repo.git',
          enableLLM: true,
          llmProvider: 'openai',
          llmApiKey: 'test-key',
        },
      },
      {
        name: 'Different branch',
        payload: {
          repositoryUrl: 'https://github.com/test/branch-repo.git',
          branch: 'develop',
        },
      },
    ];

    const results = await Promise.all(
      testCases.map(async (testCase) => {
        const startTime = Date.now();
        
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/scans',
          payload: testCase.payload,
          headers: {
            authorization: 'Bearer test-token',
          },
        });

        const submissionTime = Date.now() - startTime;

        return {
          name: testCase.name,
          statusCode: response.statusCode,
          submissionTime,
          body: JSON.parse(response.payload),
        };
      })
    );

    // Verify all test cases succeeded quickly
    results.forEach(result => {
      expect(result.statusCode).toBe(201);
      expect(result.submissionTime).toBeLessThan(500);
      expect(result.body.success).toBe(true);
      expect(result.body.data.status).toBe('queued');
    });
  });
});
