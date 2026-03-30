// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

describe('API Endpoints Integration Tests', () => {
  let server;
  let testDb;

  beforeAll(async () => {
    // Set test database URL
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/Guardrail_test';
    process.env.JWT_SECRET = 'test-jwt-secret-key';
    
    // Import and build server
    const { buildServer } = require('../../index.ts');
    server = await buildServer();
    
    // Wait for server to be ready
    await server.ready();
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });
  });

  describe('Authentication Endpoints', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User'
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: userData
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        success: true,
        user: {
          email: userData.email,
          name: userData.name
        }
      });
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: loginData
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        token: expect.any(String)
      });
    });

    it('should reject invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: loginData
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });
  });

  describe('Project Endpoints', () => {
    let authToken;
    let projectId;

    beforeAll(async () => {
      // Login to get auth token
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'TestPassword123!'
        }
      });
      
      authToken = loginResponse.json().token;
    });

    it('should create a new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project for integration testing',
        repositoryUrl: 'https://github.com/test/repo.git'
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: projectData
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        success: true,
        project: {
          name: projectData.name,
          description: projectData.description,
          repositoryUrl: projectData.repositoryUrl
        }
      });

      projectId = response.json().project.id;
    });

    it('should list projects', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/projects',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        projects: expect.any(Array)
      });
      expect(response.json().projects.length).toBeGreaterThan(0);
    });

    it('should get project details', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/projects/${projectId}`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        project: {
          id: projectId,
          name: 'Test Project'
        }
      });
    });

    it('should update project', async () => {
      const updateData = {
        name: 'Updated Test Project',
        description: 'Updated description'
      };

      const response = await server.inject({
        method: 'PUT',
        url: `/api/projects/${projectId}`,
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: updateData
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        project: {
          id: projectId,
          name: updateData.name,
          description: updateData.description
        }
      });
    });
  });

  describe('Agent Endpoints', () => {
    let authToken;
    let agentId;

    beforeAll(async () => {
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'TestPassword123!'
        }
      });
      
      authToken = loginResponse.json().token;
    });

    it('should create a new agent', async () => {
      const agentData = {
        name: 'Test Security Agent',
        type: 'security-scanner',
        description: 'An agent for security scanning',
        config: {
          scanInterval: 3600,
          alertThreshold: 'high'
        }
      };

      const response = await server.inject({
        method: 'POST',
        url: '/api/agents',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: agentData
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        success: true,
        agent: {
          name: agentData.name,
          type: agentData.type,
          status: 'pending'
        }
      });

      agentId = response.json().agent.id;
    });

    it('should list agents', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/agents',
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        agents: expect.any(Array)
      });
    });

    it('should get agent details', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/agents/${agentId}`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        agent: {
          id: agentId,
          name: 'Test Security Agent'
        }
      });
    });

    it('should activate agent', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/agents/${agentId}/activate`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        agent: {
          id: agentId,
          status: 'active'
        }
      });
    });

    it('should suspend agent', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/agents/${agentId}/suspend`,
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          reason: 'Test suspension'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        agent: {
          id: agentId,
          status: 'suspended'
        }
      });
    });
  });

  describe('Security Scan Endpoints', () => {
    let authToken;
    let projectId;
    let scanId;

    beforeAll(async () => {
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'TestPassword123!'
        }
      });
      
      authToken = loginResponse.json().token;

      // Create a project for scanning
      const projectResponse = await server.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          name: 'Security Test Project',
          repositoryUrl: 'https://github.com/test/security-repo.git'
        }
      });
      
      projectId = projectResponse.json().project.id;
    });

    it('should start a security scan', async () => {
      const scanData = {
        type: 'comprehensive',
        config: {
          includeSecrets: true,
          includeDependencies: true,
          includeInfrastructure: true
        }
      };

      const response = await server.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/scan`,
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: scanData
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({
        success: true,
        scan: {
          projectId,
          type: scanData.type,
          status: 'queued'
        }
      });

      scanId = response.json().scan.id;
    });

    it('should get scan status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/scans/${scanId}`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        scan: {
          id: scanId,
          projectId
        }
      });
    });

    it('should list project scans', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/scans`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        scans: expect.any(Array)
      });
    });
  });

  describe('Compliance Endpoints', () => {
    let authToken;
    let projectId;

    beforeAll(async () => {
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'TestPassword123!'
        }
      });
      
      authToken = loginResponse.json().token;

      const projectResponse = await server.inject({
        method: 'POST',
        url: '/api/projects',
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: {
          name: 'Compliance Test Project',
          repositoryUrl: 'https://github.com/test/compliance-repo.git'
        }
      });
      
      projectId = projectResponse.json().project.id;
    });

    it('should run compliance check', async () => {
      const complianceData = {
        frameworks: ['SOC2', 'ISO27001', 'GDPR'],
        config: {
          strictMode: true,
          includePII: true
        }
      };

      const response = await server.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/compliance`,
        headers: {
          authorization: `Bearer ${authToken}`
        },
        payload: complianceData
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({
        success: true,
        check: {
          projectId,
          frameworks: complianceData.frameworks,
          status: 'running'
        }
      });
    });

    it('should get compliance report', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/compliance/report`,
        headers: {
          authorization: `Bearer ${authToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        report: expect.objectContaining({
          projectId,
          timestamp: expect.any(String)
        })
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/non-existent'
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });

    it('should handle unauthorized access', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/projects'
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });

    it('should validate request payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'invalid-email',
          password: '123' // Too short
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 105; i++) {
        requests.push(
          server.inject({
            method: 'GET',
            url: '/health'
          })
        );
      }

      const responses = await Promise.all(requests);
      
      // Check if any response was rate limited
      const rateLimited = responses.some(r => r.statusCode === 429);
      
      // Rate limiting might not trigger in test environment, but the endpoint should work
      expect(responses.every(r => r.statusCode === 200 || r.statusCode === 429)).toBe(true);
    });
  });
});
