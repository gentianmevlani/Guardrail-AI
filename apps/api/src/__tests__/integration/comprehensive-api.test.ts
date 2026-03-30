/**
 * Comprehensive API Integration Tests
 * Tests all major API endpoints with proper authentication, validation, and error handling
 */

import { FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { TestHelpers, TestUtils } from '../setup/test-setup';

/** Standard API JSON envelope from inject */
function parseInjectBody<T>(res: LightMyRequestResponse): T {
  return JSON.parse(res.body) as T;
}

describe('Comprehensive API Integration Tests', () => {
  let server: FastifyInstance;
  let fixtures: any;

  beforeAll(async () => {
    const context = TestUtils.getContext()!;
    server = context.server;
    fixtures = context.fixtures;
  });

  describe('Health Check Endpoints', () => {
    test('GET /health should return healthy status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      const body = TestHelpers.assertApiResponse(response, 200);
      
      expect(body.data).toHaveProperty('status', 'healthy');
      expect(body.data).toHaveProperty('timestamp');
      expect(body.data).toHaveProperty('services');
    });

    test('GET /health/live should return alive status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health/live',
      });

      const body = TestHelpers.assertApiResponse(response, 200);
      
      expect(body.data).toHaveProperty('status', 'alive');
    });

    test('GET /health/ready should return ready status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health/ready',
      });

      const body = TestHelpers.assertApiResponse(response, 200);
      
      expect(body.data).toHaveProperty('status', 'ready');
    });
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/v1/auth/register should create new user', async () => {
      const userData = {
        email: TestUtils.generateRandomData('email'),
        password: 'TestPassword123!',
        name: TestUtils.generateRandomData('name'),
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: userData,
      });

      const body = TestHelpers.assertApiResponse(response, 201);
      
      expect(body.data).toHaveProperty('user');
      expect(body.data).toHaveProperty('token');
      expect(body.data).toHaveProperty('refreshToken');
      expect(body.data.user.email).toBe(userData.email);
      expect(body.data.user.name).toBe(userData.name);
    });

    test('POST /api/v1/auth/login should authenticate user', async () => {
      const loginData = {
        email: fixtures.users[0].email,
        password: 'TestPassword123!',
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: loginData,
      });

      const body = TestHelpers.assertApiResponse(response, 200);
      
      expect(body.data).toHaveProperty('user');
      expect(body.data).toHaveProperty('token');
      expect(body.data).toHaveProperty('refreshToken');
      expect(body.data.user.email).toBe(loginData.email);
    });

    test('POST /api/v1/auth/login should fail with invalid credentials', async () => {
      const loginData = {
        email: fixtures.users[0].email,
        password: 'WrongPassword123!',
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: loginData,
      });

      TestHelpers.assertErrorResponse(response, 401, 'UNAUTHORIZED');
    });

    test('POST /api/v1/auth/refresh should refresh access token', async () => {
      // First login to get refresh token
      const loginResponse: LightMyRequestResponse = await TestHelpers.makeAuthenticatedRequest(
        server,
        'POST',
        '/api/v1/auth/login',
        {
          email: fixtures.users[0].email,
          password: 'TestPassword123!',
        }
      );

      const loginJson = parseInjectBody<{ data: { refreshToken: string } }>(loginResponse);
      const refreshToken = loginJson.data.refreshToken;

      // Now refresh the token
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken },
      });

      const body = TestHelpers.assertApiResponse(response, 200);
      
      expect(body.data).toHaveProperty('token');
      expect(body.data.token).toBeDefined();
    });
  });

  describe('User Management Endpoints', () => {
    test('GET /api/v1/users/profile should return user profile', async () => {
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'GET',
        '/api/v1/users/profile',
        undefined,
        fixtures.users[0].id
      );

      const body = TestHelpers.assertApiResponse(response, 200);
      
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('email');
      expect(body.data).toHaveProperty('name');
      expect(body.data.email).toBe(fixtures.users[0].email);
    });

    test('PUT /api/v1/users/profile should update user profile', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'PUT',
        '/api/v1/users/profile',
        updateData,
        fixtures.users[0].id
      );

      const body = TestHelpers.assertApiResponse(response, 200);
      
      expect(body.data).toHaveProperty('name', updateData.name);
    });

    test('POST /api/v1/users/change-password should change password', async () => {
      const passwordData = {
        currentPassword: 'TestPassword123!',
        newPassword: 'NewPassword456!',
      };

      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'POST',
        '/api/v1/users/change-password',
        passwordData,
        fixtures.users[0].id
      );

      TestHelpers.assertApiResponse(response, 200);
    });
  });

  describe('Project Management Endpoints', () => {
    test('GET /api/v1/projects should return user projects', async () => {
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'GET',
        '/api/v1/projects',
        undefined,
        fixtures.users[0].id
      );

      const body = TestHelpers.assertPaginatedResponse(response, 200);
      
      expect(body.data).toBeInstanceOf(Array);
      expect(body.pagination.total).toBeGreaterThan(0);
    });

    test('POST /api/v1/projects should create new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project created during testing',
        visibility: 'private',
      };

      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'POST',
        '/api/v1/projects',
        projectData,
        fixtures.users[0].id
      );

      const body = TestHelpers.assertApiResponse(response, 201);
      
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('name', projectData.name);
      expect(body.data).toHaveProperty('description', projectData.description);
      expect(body.data).toHaveProperty('visibility', projectData.visibility);
    });

    test('GET /api/v1/projects/:id should return specific project', async () => {
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'GET',
        `/api/v1/projects/${fixtures.projects[0].id}`,
        undefined,
        fixtures.projects[0].userId
      );

      const body = TestHelpers.assertApiResponse(response, 200);
      
      expect(body.data).toHaveProperty('id', fixtures.projects[0].id);
      expect(body.data).toHaveProperty('name', fixtures.projects[0].name);
    });

    test('PUT /api/v1/projects/:id should update project', async () => {
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description',
      };

      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'PUT',
        `/api/v1/projects/${fixtures.projects[0].id}`,
        updateData,
        fixtures.projects[0].userId
      );

      const body = TestHelpers.assertApiResponse(response, 200);
      
      expect(body.data).toHaveProperty('name', updateData.name);
      expect(body.data).toHaveProperty('description', updateData.description);
    });

    test('DELETE /api/v1/projects/:id should delete project', async () => {
      // First create a project to delete
      const createResponse: LightMyRequestResponse = await TestHelpers.makeAuthenticatedRequest(
        server,
        'POST',
        '/api/v1/projects',
        {
          name: 'Project to Delete',
          description: 'This project will be deleted',
          visibility: 'private',
        },
        fixtures.users[0].id
      );

      const projectJson = parseInjectBody<{ data: { id: string } }>(createResponse);
      const projectId = projectJson.data.id;

      // Now delete it
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'DELETE',
        `/api/v1/projects/${projectId}`,
        undefined,
        fixtures.users[0].id
      );

      TestHelpers.assertApiResponse(response, 200);
    });
  });

  describe('API Key Management Endpoints', () => {
    test('GET /api/v1/api-keys should return user API keys', async () => {
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'GET',
        '/api/v1/api-keys',
        undefined,
        fixtures.users[0].id
      );

      const body = TestHelpers.assertPaginatedResponse(response, 200);
      
      expect(body.data).toBeInstanceOf(Array);
      expect(body.pagination.total).toBeGreaterThan(0);
    });

    test('POST /api/v1/api-keys should create new API key', async () => {
      const keyData = {
        name: 'Test API Key',
        scopes: ['read', 'write'],
        expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(), // 30 days
      };

      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'POST',
        '/api/v1/api-keys',
        keyData,
        fixtures.users[0].id
      );

      const body = TestHelpers.assertApiResponse(response, 201);
      
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('name', keyData.name);
      expect(body.data).toHaveProperty('key');
      expect(body.data).toHaveProperty('scopes');
      expect(body.data.scopes).toEqual(keyData.scopes);
    });

    test('DELETE /api/v1/api-keys/:id should revoke API key', async () => {
      // First create an API key to revoke
      const createResponse: LightMyRequestResponse = await TestHelpers.makeAuthenticatedRequest(
        server,
        'POST',
        '/api/v1/api-keys',
        {
          name: 'API Key to Revoke',
          scopes: ['read'],
        },
        fixtures.users[0].id
      );

      const keyJson = parseInjectBody<{ data: { id: string } }>(createResponse);
      const keyId = keyJson.data.id;

      // Now revoke it
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'DELETE',
        `/api/v1/api-keys/${keyId}`,
        undefined,
        fixtures.users[0].id
      );

      TestHelpers.assertApiResponse(response, 200);
    });
  });

  describe('File Upload Endpoints', () => {
    test('POST /api/v1/files/upload should handle file upload', async () => {
      // This would typically use multipart form data
      // For testing purposes, we'll simulate the upload
      const fileData = {
        filename: 'test-document.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        content: Buffer.from('test file content'),
      };

      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'POST',
        '/api/v1/files/upload',
        fileData,
        fixtures.users[0].id
      );

      const body = TestHelpers.assertApiResponse(response, 201);
      
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('originalName', fileData.filename);
      expect(body.data).toHaveProperty('mimetype', fileData.mimetype);
      expect(body.data).toHaveProperty('size', fileData.size);
      expect(body.data).toHaveProperty('url');
    });

    test('GET /api/v1/files/:id should return file metadata', async () => {
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'GET',
        `/api/v1/files/${fixtures.files[0].id}`,
        undefined,
        fixtures.files[0].userId
      );

      const body = TestHelpers.assertApiResponse(response, 200);
      
      expect(body.data).toHaveProperty('id', fixtures.files[0].id);
      expect(body.data).toHaveProperty('originalName', fixtures.files[0].originalName);
      expect(body.data).toHaveProperty('url', fixtures.files[0].url);
    });

    test('DELETE /api/v1/files/:id should delete file', async () => {
      // This would typically delete a file from storage
      // For testing, we'll just simulate the deletion
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'DELETE',
        `/api/v1/files/${fixtures.files[0].id}`,
        undefined,
        fixtures.files[0].userId
      );

      TestHelpers.assertApiResponse(response, 200);
    });
  });

  describe('Webhook Management Endpoints', () => {
    test('GET /api/v1/webhooks should return user webhooks', async () => {
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'GET',
        '/api/v1/webhooks',
        undefined,
        fixtures.users[0].id
      );

      const body = TestHelpers.assertPaginatedResponse(response, 200);
      
      expect(body.data).toBeInstanceOf(Array);
      expect(body.pagination.total).toBeGreaterThan(0);
    });

    test('POST /api/v1/webhooks should create new webhook', async () => {
      const webhookData = {
        url: 'https://example.com/webhook-test',
        events: ['user.created', 'project.updated'],
        secret: 'webhook-secret-test',
      };

      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'POST',
        '/api/v1/webhooks',
        webhookData,
        fixtures.users[0].id
      );

      const body = TestHelpers.assertApiResponse(response, 201);
      
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('url', webhookData.url);
      expect(body.data).toHaveProperty('events');
      expect(body.data.events).toEqual(webhookData.events);
    });

    test('POST /api/v1/webhooks/:id/test should test webhook delivery', async () => {
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'POST',
        `/api/v1/webhooks/${fixtures.webhooks[0].id}/test`,
        {
          testEvent: 'user.created',
          testData: { userId: fixtures.users[0].id },
        },
        fixtures.webhooks[0].userId
      );

      const body = TestHelpers.assertApiResponse(response, 200);
      
      expect(body.data).toHaveProperty('success');
      expect(body.data).toHaveProperty('deliveryResult');
    });
  });

  describe('Error Handling', () => {
    test('Should return 404 for non-existent endpoints', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/non-existent-endpoint',
      });

      TestHelpers.assertErrorResponse(response, 404, 'NOT_FOUND');
    });

    test('Should return 401 for unauthenticated requests', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/users/profile',
      });

      TestHelpers.assertErrorResponse(response, 401, 'UNAUTHORIZED');
    });

    test('Should return 403 for unauthorized requests', async () => {
      // Try to access admin endpoint as regular user
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'GET',
        '/api/v1/admin/users',
        undefined,
        fixtures.users[0].id // Regular user
      );

      TestHelpers.assertErrorResponse(response, 403, 'FORBIDDEN');
    });

    test('Should return 400 for invalid input', async () => {
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'POST',
        '/api/v1/projects',
        {
          name: '', // Invalid: empty name
          description: 'A project with invalid data',
        },
        fixtures.users[0].id
      );

      TestHelpers.assertErrorResponse(response, 400, 'VALIDATION_FAILED');
    });

    test('Should return 429 for rate limited requests', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array.from({ length: 10 }, () =>
        TestHelpers.makeAuthenticatedRequest(
          server,
          'GET',
          '/api/v1/projects',
          undefined,
          fixtures.users[0].id
        )
      );

      const responses = await Promise.all(requests);
      
      // At least one should be rate limited
      const rateLimitedResponses = responses.filter(
        response => response.statusCode === 429
      );
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    test('Should validate email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'TestPassword123!',
          name: 'Test User',
        },
      });

      TestHelpers.assertErrorResponse(response, 400, 'VALIDATION_FAILED');
    });

    test('Should validate password strength', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: TestUtils.generateRandomData('email'),
          password: 'weak', // Too weak
          name: 'Test User',
        },
      });

      TestHelpers.assertErrorResponse(response, 400, 'VALIDATION_FAILED');
    });

    test('Should validate required fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: {
          // Missing required 'name' field
          description: 'A project without a name',
        },
        headers: {
          Authorization: `Bearer ${TestUtils.generateTestToken(fixtures.users[0].id)}`,
        },
      });

      TestHelpers.assertErrorResponse(response, 400, 'VALIDATION_FAILED');
    });
  });

  describe('Pagination', () => {
    test('Should paginate results correctly', async () => {
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'GET',
        '/api/v1/projects?page=1&limit=5',
        undefined,
        fixtures.users[0].id
      );

      const body = TestHelpers.assertPaginatedResponse(response, 200);
      
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(5);
      expect(body.data.length).toBeLessThanOrEqual(5);
    });

    test('Should handle cursor-based pagination', async () => {
      const response = await TestHelpers.makeAuthenticatedRequest(
        server,
        'GET',
        '/api/v1/projects?cursor=abc123&limit=10',
        undefined,
        fixtures.users[0].id
      );

      const body = TestHelpers.assertPaginatedResponse(response, 200);
      
      expect(body.pagination).toHaveProperty('limit', 10);
      expect(body.data).toBeInstanceOf(Array);
    });
  });
});
