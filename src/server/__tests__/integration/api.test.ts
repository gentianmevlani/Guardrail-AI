import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../index';

describe('API Integration Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Mock authentication for testing
    authToken = 'Bearer test-jwt-token';
    
    // Setup test database or mocks
    jest.setTimeout(30000);
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Authentication Routes', () => {
    describe('POST /api/auth/login', () => {
      it('should authenticate with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'password123'
          })
          .expect(200);

        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.email).toBe('test@example.com');
      });

      it('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com'
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/auth/register', () => {
      it('should register a new user', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'newuser@example.com',
            password: 'password123',
            name: 'New User'
          })
          .expect(201);

        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.email).toBe('newuser@example.com');
      });

      it('should reject duplicate email', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: 'password123',
            name: 'Test User'
          })
          .expect(409);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Agent Routes', () => {
    describe('GET /api/agents', () => {
      it('should list agents for authenticated user', async () => {
        const response = await request(app)
          .get('/api/agents')
          .set('Authorization', authToken)
          .expect(200);

        expect(response.body).toHaveProperty('agents');
        expect(Array.isArray(response.body.agents)).toBe(true);
      });

      it('should require authentication', async () => {
        await request(app.server)
          .get('/api/agents')
          .expect(401);
      });
    });

    describe('POST /api/agents', () => {
      it('should register a new agent (admin only)', async () => {
        const agentData = {
          agentId: 'test-agent-1',
          name: 'Test Agent',
          type: 'code-review',
          model: 'gpt-4',
          scope: {
            filesystem: { read: true, write: false },
            network: { allowed: ['api.openai.com'] },
            shell: { enabled: false },
            resources: { maxMemory: '512MB' }
          }
        };

        // Mock admin authentication
        const adminToken = 'Bearer admin-jwt-token';

        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', adminToken)
          .send(agentData)
          .expect(201);

        expect(response.body).toHaveProperty('agent');
        expect(response.body.agent.id).toBe(agentData.agentId);
      });

      it('should reject non-admin users', async () => {
        const agentData = {
          agentId: 'test-agent-2',
          name: 'Test Agent',
          type: 'code-review',
          scope: {}
        };

        const response = await request(app)
          .post('/api/agents')
          .set('Authorization', authToken)
          .send(agentData)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('PUT /api/agents/:agentId/permissions', () => {
      it('should update agent permissions', async () => {
        const agentId = 'test-agent-1';
        const permissions = {
          filesystem: { read: true, write: true },
          network: { allowed: ['api.openai.com', 'api.github.com'] }
        };

        const response = await request(app)
          .put(`/api/agents/${agentId}/permissions`)
          .set('Authorization', authToken)
          .send(permissions)
          .expect(200);

        expect(response.body).toHaveProperty('agent');
        expect(response.body.agent.permissions).toEqual(permissions);
      });

      it('should return 404 for non-existent agent', async () => {
        const response = await request(app)
          .put('/api/agents/non-existent/permissions')
          .set('Authorization', authToken)
          .send({ filesystem: { read: true } })
          .expect(404);
      });
    });
  });

  describe('Code Analysis Routes', () => {
    describe('POST /api/analyze', () => {
      it('should analyze submitted code', async () => {
        const codeData = {
          code: 'function test() { return "hello"; }',
          language: 'javascript',
          options: {
            checkSecurity: true,
            checkQuality: true,
            checkStyle: false
          }
        };

        const response = await request(app)
          .post('/api/analyze')
          .set('Authorization', authToken)
          .send(codeData)
          .expect(200);

        expect(response.body).toHaveProperty('results');
        expect(response.body.results).toHaveProperty('security');
        expect(response.body.results).toHaveProperty('quality');
        expect(response.body.results).toHaveProperty('summary');
      });

      it('should validate code input', async () => {
        const response = await request(app)
          .post('/api/analyze')
          .set('Authorization', authToken)
          .send({
            language: 'javascript'
            // Missing code
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/analyze/repository', () => {
      it('should analyze repository', async () => {
        const repoData = {
          url: 'https://github.com/test/repo',
          branch: 'main',
          depth: 'shallow'
        };

        const response = await request(app)
          .post('/api/analyze/repository')
          .set('Authorization', authToken)
          .send(repoData)
          .expect(200);

        expect(response.body).toHaveProperty('analysisId');
        expect(response.body).toHaveProperty('status', 'queued');
      });

      it('should validate repository URL', async () => {
        const response = await request(app)
          .post('/api/analyze/repository')
          .set('Authorization', authToken)
          .send({
            url: 'not-a-url',
            branch: 'main'
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('guardrail Routes', () => {
    describe('GET /api/guardrails', () => {
      it('should list available guardrails', async () => {
        const response = await request(app)
          .get('/api/guardrails')
          .set('Authorization', authToken)
          .expect(200);

        expect(response.body).toHaveProperty('guardrails');
        expect(Array.isArray(response.body.guardrails)).toBe(true);
      });
    });

    describe('POST /api/guardrails/check', () => {
      it('should check code against guardrails', async () => {
        const checkData = {
          code: 'eval("alert("xss")")',
          rules: ['no-eval', 'no-alert', 'security-checks']
        };

        const response = await request(app)
          .post('/api/guardrails/check')
          .set('Authorization', authToken)
          .send(checkData)
          .expect(200);

        expect(response.body).toHaveProperty('violations');
        expect(response.body).toHaveProperty('passed');
        expect(Array.isArray(response.body.violations)).toBe(true);
      });
    });
  });

  describe('User Management Routes', () => {
    describe('GET /api/users/profile', () => {
      it('should return user profile', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', authToken)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toHaveProperty('email');
        expect(response.body.user).toHaveProperty('name');
        expect(response.body.user).not.toHaveProperty('password');
      });
    });

    describe('PUT /api/users/profile', () => {
      it('should update user profile', async () => {
        const updateData = {
          name: 'Updated Name',
          preferences: {
            theme: 'dark',
            notifications: true
          }
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', authToken)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        expect(response.body.user.name).toBe('Updated Name');
        expect(response.body.user.preferences).toEqual(updateData.preferences);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: ''
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('validation');
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests
      const requests = Array(100).fill(null).map(() =>
        request(app.server)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password123' })
      );

      const responses = await Promise.all(requests);
      
      // At least one should be rate limited
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('CORS', () => {
    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/analyze')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });
});
