/**
 * Compliance API Routes Tests
 * 
 * Integration tests for GDPR, consent management, and legal acceptance endpoints.
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '../../db';
import { buildServer } from '../../index';

describe('Compliance API Routes', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    app = await buildServer();
    
    // Create test user and get auth token
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'compliance-test@example.com',
        password: 'testpassword123',
        name: 'Compliance Test User',
      },
    });

    const registerData = JSON.parse(registerResponse.payload);
    authToken = registerData.data.token;
    testUserId = registerData.data.user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.delete({
      where: { id: testUserId },
    });
    
    await app.close();
  });

  beforeEach(async () => {
    // Cleanup compliance data for test user
    await prisma.consentPreferences.deleteMany({ where: { userId: testUserId } });
    await prisma.legalAcceptance.deleteMany({ where: { userId: testUserId } });
    await prisma.gdprJob.deleteMany({ where: { userId: testUserId } });
    await prisma.gdprAuditLog.deleteMany({ where: { userId: testUserId } });
  });

  describe('Consent Management', () => {
    it('should get consent preferences (empty)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/legal/consent',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        necessary: true,
        analytics: false,
        marketing: false,
        functional: false,
      });
    });

    it('should update consent preferences', async () => {
      const preferences = {
        necessary: true,
        analytics: true,
        marketing: false,
        functional: true,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/consent',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: preferences,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(preferences);

      // Verify in database
      const dbPreferences = await prisma.consentPreferences.findUnique({
        where: { userId: testUserId },
      });
      expect(dbPreferences).toMatchObject(preferences);
    });

    it('should reject invalid consent preferences', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/consent',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          necessary: 'invalid',
          analytics: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require authentication for consent endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/legal/consent',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Legal Acceptance', () => {
    it('should get legal acceptance status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/legal/status',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('terms');
      expect(data.data).toHaveProperty('privacy');
      expect(data.data.terms).toHaveProperty('accepted');
      expect(data.data.terms).toHaveProperty('currentVersion');
      expect(data.data.privacy).toHaveProperty('accepted');
      expect(data.data.privacy).toHaveProperty('currentVersion');
    });

    it('should accept legal document', async () => {
      const acceptance = {
        docType: 'terms',
        version: '1.0',
        locale: 'en',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/accept',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: acceptance,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        userId: testUserId,
        docType: 'terms',
        version: '1.0',
      });

      // Verify in database
      const dbAcceptance = await prisma.legalAcceptance.findUnique({
        where: {
          userId_docType: {
            userId: testUserId,
            docType: 'terms',
          },
        },
      });
      expect(dbAcceptance).toMatchObject({
        docType: 'terms',
        version: '1.0',
      });
    });

    it('should reject invalid document type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/accept',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          docType: 'invalid',
          version: '1.0',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GDPR Export', () => {
    it('should create export job', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/gdpr/export',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('jobId');

      // Verify job in database
      const job = await prisma.gdprJob.findUnique({
        where: { id: data.data.jobId },
      });
      expect(job).toMatchObject({
        userId: testUserId,
        type: 'EXPORT',
        status: 'pending',
      });
    });

    it('should reject duplicate export job', async () => {
      // Create first job
      await app.inject({
        method: 'POST',
        url: '/api/v1/legal/gdpr/export',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Try to create second job
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/gdpr/export',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(409);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Export job already in progress');
    });

    it('should get export job status', async () => {
      // Create job first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/gdpr/export',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      const { jobId } = JSON.parse(createResponse.payload).data;

      // Get status
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/legal/gdpr/export/${jobId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id', jobId);
      expect(data.data).toHaveProperty('status');
    });

    it('should return 404 for non-existent export job', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/legal/gdpr/export/non-existent',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GDPR Deletion', () => {
    it('should create deletion job', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/gdpr/delete',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('jobId');

      // Verify job in database
      const job = await prisma.gdprJob.findUnique({
        where: { id: data.data.jobId },
      });
      expect(job).toMatchObject({
        userId: testUserId,
        type: 'DELETE',
        status: 'pending',
      });
    });

    it('should reject duplicate deletion job', async () => {
      // Create first job
      await app.inject({
        method: 'POST',
        url: '/api/v1/legal/gdpr/delete',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Try to create second job
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/gdpr/delete',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(409);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Deletion job already in progress');
    });

    it('should get deletion job status', async () => {
      // Create job first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/gdpr/delete',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });
      const { jobId } = JSON.parse(createResponse.payload).data;

      // Get status
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/legal/gdpr/delete/${jobId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id', jobId);
      expect(data.data).toHaveProperty('status');
    });
  });

  describe('Age Verification', () => {
    it('should confirm age when old enough', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/age/confirm',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          age: 18,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Age confirmed successfully');

      // Verify in database
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { isAgeConfirmed: true, ageConfirmedAt: true },
      });
      expect(user?.isAgeConfirmed).toBe(true);
      expect(user?.ageConfirmedAt).toBeInstanceOf(Date);
    });

    it('should reject age confirmation when too young', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/legal/age/confirm',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          age: 14,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error).toContain('User must be at least 16 years old');
    });

    it('should check age confirmation status', async () => {
      // First confirm age
      await app.inject({
        method: 'POST',
        url: '/api/v1/legal/age/confirm',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          age: 18,
        },
      });

      // Check status
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/legal/age/status',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.isAgeConfirmed).toBe(true);
    });

    it('should return false for unconfirmed age', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/legal/age/status',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.isAgeConfirmed).toBe(false);
    });
  });

  describe('Security & Rate Limiting', () => {
    it('should reject requests without authentication', async () => {
      const endpoints = [
        { method: 'GET', url: '/api/v1/legal/consent' },
        { method: 'POST', url: '/api/v1/legal/consent' },
        { method: 'GET', url: '/api/v1/legal/status' },
        { method: 'POST', url: '/api/v1/legal/accept' },
        { method: 'POST', url: '/api/v1/legal/gdpr/export' },
        { method: 'POST', url: '/api/v1/legal/gdpr/delete' },
        { method: 'POST', url: '/api/v1/legal/age/confirm' },
        { method: 'GET', url: '/api/v1/legal/age/status' },
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method as any,
          url: endpoint.url,
        });

        expect(response.statusCode).toBe(401);
      }
    });

    it('should reject invalid tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/legal/consent',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Input Validation', () => {
    it('should validate consent preferences schema', async () => {
      const invalidPayloads = [
        { necessary: 'not-a-boolean' },
        { analytics: 'not-a-boolean' },
        { marketing: 'not-a-boolean' },
        { functional: 'not-a-boolean' },
        { invalidField: true },
      ];

      for (const payload of invalidPayloads) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/legal/consent',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload,
        });

        expect(response.statusCode).toBe(400);
      }
    });

    it('should validate legal acceptance schema', async () => {
      const invalidPayloads = [
        { docType: 'invalid-type', version: '1.0' },
        { docType: 'terms', version: '' },
        { docType: 'privacy' }, // missing version
        { version: '1.0' }, // missing docType
      ];

      for (const payload of invalidPayloads) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/legal/accept',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload,
        });

        expect(response.statusCode).toBe(400);
      }
    });

    it('should validate age confirmation schema', async () => {
      const invalidPayloads = [
        { age: 'not-a-number' },
        { age: -5 },
        { age: 150 },
        {}, // missing age
      ];

      for (const payload of invalidPayloads) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/legal/age/confirm',
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload,
        });

        expect(response.statusCode).toBe(400);
      }
    });
  });
});
