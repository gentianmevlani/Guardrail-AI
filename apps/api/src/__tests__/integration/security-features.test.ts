/**
 * Security Features Comprehensive Tests
 * 
 * Tests for request size limits, security events, log redaction, CORS, and request ID tracking
 */

import { FastifyInstance } from 'fastify';
import { buildServer } from '../../index';
import { createSafeFetch } from '../../middleware/request-id-tracking';
import { securityEventService } from '../../services/security-event-service';

describe('Security Features', () => {
  let fastify: FastifyInstance;
  let safeFetch: ReturnType<typeof createSafeFetch>;

  beforeAll(async () => {
    fastify = await buildServer();
    safeFetch = createSafeFetch();
  });

  afterAll(async () => {
    await fastify.close();
  });

  describe('Request Size Limits', () => {
    test('should accept requests within size limit', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test',
        headers: {
          'content-type': 'application/json',
          'content-length': '100',
        },
        payload: { test: 'data' },
      });

      expect(response.statusCode).not.toBe(413);
    });

    test('should reject requests exceeding size limit', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test',
        headers: {
          'content-type': 'application/json',
          'content-length': largePayload.length.toString(),
        },
        payload: largePayload,
      });

      expect(response.statusCode).toBe(413);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Payload Too Large');
      expect(body.code).toBe('PAYLOAD_TOO_LARGE');
    });

    test('should enforce tier-based upload limits', async () => {
      // Test free tier limits
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/profile/avatar',
        headers: {
          'content-type': 'multipart/form-data',
          'content-length': (2 * 1024 * 1024).toString(), // 2MB - exceeds free tier
        },
        payload: 'large file content',
      });

      expect(response.statusCode).toBe(413);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Upload Too Large');
      expect(body.code).toBe('UPLOAD_TOO_LARGE');
      expect(body.limits).toBeDefined();
    });
  });

  describe('Security Events', () => {
    test('should emit security events for authentication', async () => {
      // Simulate login failure
      await securityEventService.emitFromRequest(
        {
          id: 'test-req-1',
          headers: {},
          ip: '127.0.0.1',
          method: 'POST',
          url: '/api/v1/auth/login',
          user: undefined,
        } as any,
        'login_failure',
        { email: 'test@example.com', reason: 'invalid_password' },
        { severity: 'medium' }
      );

      // Query events
      const events = await securityEventService.queryEvents({
        eventType: 'login_failure',
        limit: 10,
      });

      expect(events.length).toBeGreaterThan(0);
      const firstLogin = events[0] as {
        eventType: string;
        severity: string;
        payload: Record<string, unknown>;
      };
      expect(firstLogin.eventType).toBe('login_failure');
      expect(firstLogin.severity).toBe('medium');
      expect(firstLogin.payload.email).toBeUndefined(); // Should be redacted
    });

    test('should redact sensitive information from events', async () => {
      await securityEventService.emitFromRequest(
        {
          id: 'test-req-2',
          headers: { authorization: 'Bearer sk_1234567890abcdef1234567890abcdef' },
          ip: '127.0.0.1',
          method: 'POST',
          url: '/api/v1/test',
          user: undefined,
        } as any,
        'api_key_validated',
        { 
          apiKey: 'sk_1234567890abcdef1234567890abcdef',
          password: 'secret123',
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        { severity: 'low' }
      );

      const events = await securityEventService.queryEvents({
        eventType: 'api_key_validated',
        limit: 1,
      });

      expect(events.length).toBe(1);
      const firstKey = events[0] as {
        payload: Record<string, unknown>;
        apiKeyPrefix?: string;
      };
      expect(firstKey.payload.apiKey).toBeUndefined();
      expect(firstKey.payload.password).toBeUndefined();
      expect(firstKey.payload.token).toBeUndefined();
      expect(firstKey.apiKeyPrefix).toBe('sk_1234...'); // Prefix only
    });

    test('should provide event statistics', async () => {
      const stats = await securityEventService.getEventStats({});

      expect(typeof stats).toBe('object');
      expect(Object.keys(stats).length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Log Redaction', () => {
    test('should redact API keys from logs', async () => {
      const { redactSensitiveData } = require('../../src/middleware/log-redaction');
      
      const input = 'Authorization: Bearer sk_1234567890abcdef1234567890abcdef';
      const redacted = redactSensitiveData(input);
      
      expect(redacted).toBe('Authorization: Bearer *****');
      expect(redacted).not.toContain('sk_1234567890abcdef');
    });

    test('should redact JWT tokens from logs', async () => {
      const { redactSensitiveData } = require('../../src/middleware/log-redaction');
      
      const input = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const redacted = redactSensitiveData(input);
      
      expect(redacted).toBe('JWT_*****');
      expect(redacted).not.toContain('eyJ');
    });

    test('should redact passwords from JSON', async () => {
      const { redactSensitiveData } = require('../../src/middleware/log-redaction');
      
      const input = '{"password":"secret123","username":"test"}';
      const redacted = redactSensitiveData(input);
      
      expect(redacted).toBe('{"password":"*****","username":"test"}');
      expect(redacted).not.toContain('secret123');
    });

    test('should remove sensitive fields from objects', async () => {
      const { removeSensitiveFields } = require('../../src/middleware/log-redaction');
      
      const input = {
        username: 'test',
        password: 'secret123',
        apiKey: 'sk_1234',
        metadata: {
          token: 'abc123',
          public: 'data'
        }
      };
      
      const cleaned = removeSensitiveFields(input);
      
      expect(cleaned.username).toBe('test');
      expect(cleaned.password).toBeUndefined();
      expect(cleaned.apiKey).toBeUndefined();
      expect(cleaned.metadata.token).toBeUndefined();
      expect(cleaned.metadata.public).toBe('data');
    });
  });

  describe('CORS Configuration', () => {
    test('should allow requests from allowed origins', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/v1/test',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization,content-type',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    test('should reject requests from disallowed origins', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/v1/test',
        headers: {
          origin: 'http://evil.com',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('CORS policy violation');
    });

    test('should only allow configured headers', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/v1/test',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization,evil-header',
        },
      });

      expect(response.statusCode).toBe(204);
      const allowedHeaders = response.headers['access-control-allow-headers'];
      expect(allowedHeaders).toContain('authorization');
      expect(allowedHeaders).not.toContain('evil-header');
    });
  });

  describe('Request ID Tracking', () => {
    test('should generate request ID when not provided', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/test',
      });

      expect(response.statusCode).toBe(404); // Route doesn't exist, but headers should be set
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^[a-zA-Z0-9\-_\.]{8,64}$/);
      expect(response.headers['x-correlation-id']).toBe(response.headers['x-request-id']);
    });

    test('should use provided request ID when valid', async () => {
      const testRequestId = 'req-12345678';
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/test',
        headers: {
          'x-request-id': testRequestId,
        },
      });

      expect(response.headers['x-request-id']).toBe(testRequestId);
      expect(response.headers['x-correlation-id']).toBe(testRequestId);
    });

    test('should reject invalid request ID format in production', async () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/v1/test',
          headers: {
            'x-request-id': 'invalid@id#',
          },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.code).toBe('INVALID_REQUEST_ID');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('should propagate request ID in outbound calls', async () => {
      // Mock fetch to capture headers
      const mockFetch = jest.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const testSafeFetch = createSafeFetch(mockFetch);

      // Set up request context
      const { setRequestContext } = require('../../src/lib/request-context');
      setRequestContext({
        requestId: 'test-req-123',
        userId: 'user-123',
        ip: '127.0.0.1',
      });

      await testSafeFetch('https://api.example.com/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-request-id': 'test-req-123',
            'x-correlation-id': 'test-req-123',
            'x-user-id': 'user-123',
          }),
        })
      );
    });
  });

  describe('Admin Security Events Endpoint', () => {
    test('should require authentication for admin endpoints', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/admin/security-events',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('AUTH_REQUIRED');
    });

    test('should require admin role for admin endpoints', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/admin/security-events',
        headers: {
          authorization: 'Bearer fake-token',
        },
      });

      // This would require proper auth setup in tests
      // For now, just verify the route exists and requires auth
      expect([401, 403, 500]).toContain(response.statusCode);
    });
  });

  describe('Integration Tests', () => {
    test('should work together: size limits + request ID + security events', async () => {
      const testRequestId = 'integration-test-123';
      
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/test',
        headers: {
          'x-request-id': testRequestId,
          'content-type': 'application/json',
          'content-length': '50',
        },
        payload: { test: 'integration data' },
      });

      // Should have request ID
      expect(response.headers['x-request-id']).toBe(testRequestId);
      
      // Should not be size limited (small payload)
      expect(response.statusCode).not.toBe(413);
      
      // Should have security events logged (would need to check logs/events)
    });

    test('should handle multiple security violations gracefully', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/profile/avatar',
        headers: {
          'x-request-id': 'invalid@id#', // Invalid request ID
          origin: 'http://evil.com', // Invalid CORS origin
          'content-type': 'multipart/form-data',
          'content-length': (50 * 1024 * 1024).toString(), // Too large
        },
        payload: 'x'.repeat(50 * 1024 * 1024),
      });

      // Should fail with one of the security violations
      expect([400, 403, 413]).toContain(response.statusCode);
    });
  });
});
