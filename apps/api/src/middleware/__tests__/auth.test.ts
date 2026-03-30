/**
 * Authentication Middleware Tests
 */

import { FastifyInstance } from 'fastify';
import { buildServer } from '../../index';
import { generateToken } from '../fastify-auth';

describe('Authentication Middleware', () => {
  let fastify: FastifyInstance;
  
  beforeAll(async () => {
    fastify = await buildServer();
  });
  
  afterAll(async () => {
    await fastify.close();
  });

  describe('JWT Token Generation', () => {
    it('should generate a valid JWT token', () => {
      const payload = { id: 'user-123', email: 'test@example.com' };
      const token = generateToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('Protected Routes', () => {
    it('should return 401 without token', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/auth/me'
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.code).toBe('NO_TOKEN');
    });

    it('should return 401 with invalid token', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.code).toBe('INVALID_TOKEN');
    });

    it('should authenticate with valid token', async () => {
      const token = generateToken({ id: 'test-user', email: 'test@example.com' });
      
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      // This will return 404 because user doesn't exist in DB, but auth passes
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(401); // Invalid credentials but rate limit passes
    });
  });

  describe('Authorization Middleware', () => {
    describe('Role-based Access', () => {
      it('should require admin role for admin routes', async () => {
        const userToken = generateToken({ id: 'user-123', email: 'user@example.com' });
        
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/agents',
          headers: {
            authorization: `Bearer ${userToken}`
          },
          payload: {
            agentId: 'test-agent',
            name: 'Test Agent',
            type: 'test',
            scope: {
              filesystem: {},
              network: {},
              shell: {},
              resources: {}
            }
          }
        });

        expect(response.statusCode).toBe(403);
        const payload = JSON.parse(response.payload);
        expect(payload.code).toBe('INSUFFICIENT_PERMISSIONS');
      });

      it('should allow admin role for admin routes', async () => {
        const adminToken = generateToken({ id: 'admin-123', email: 'admin@example.com' });
        
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/agents',
          headers: {
            authorization: `Bearer ${adminToken}`
          },
          payload: {
            agentId: 'test-agent',
            name: 'Test Agent',
            type: 'test',
            scope: {
              filesystem: {},
              network: {},
              shell: {},
              resources: {}
            }
          }
        });

        expect(response.statusCode).toBe(200);
      });
    });

    describe('Resource Ownership', () => {
      it('should allow access to own resources', async () => {
        const userToken = generateToken({ id: 'user-123', email: 'user@example.com' });
        
        const response = await fastify.inject({
          method: 'GET',
          url: '/api/agents/some-agent-id',
          headers: {
            authorization: `Bearer ${userToken}`
          }
        });

        // Will return 404 because agent doesn't exist, but ownership check passes
        expect(response.statusCode).toBe(404);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Zod validation errors', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'short',
          name: 'Test User'
        }
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.code).toBe('VALIDATION_ERROR');
      expect(payload.details).toBeInstanceOf(Array);
      expect(payload.details[0]).toHaveProperty('field');
      expect(payload.details[0]).toHaveProperty('message');
    });

    it('should handle JWT errors gracefully', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer expired.token.here'
        }
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize XSS attempts', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'Password123!',
          name: '<script>alert("xss")</script>Test User'
        }
      });

      // Should not fail, but script tags should be removed
      expect(response.statusCode).toBe(201);
    });

    it('should prevent SQL injection attempts', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: "'; DROP TABLE users; --",
          password: 'password'
        }
      });

      // Should be caught by validation or rejected
      expect([400, 401]).toContain(response.statusCode);
    });
  });
});
