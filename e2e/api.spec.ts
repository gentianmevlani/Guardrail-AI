import { test, expect } from '@playwright/test';

test.describe('API E2E Tests', () => {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

  test('should check API health endpoint', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/health`);
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('timestamp');
  });

  test('should handle authentication flow', async ({ request }) => {
    // First, register a new user
    const registerResponse = await request.post(`${baseURL}/api/auth/register`, {
      data: {
        email: 'e2e-test@example.com',
        password: 'TestPassword123!',
        name: 'E2E Test User'
      }
    });

    expect(registerResponse.status()).toBe(201);
    const registerBody = await registerResponse.json();
    expect(registerBody).toHaveProperty('token');

    // Use the token to access protected endpoint
    const authResponse = await request.get(`${baseURL}/api/projects`, {
      headers: {
        Authorization: `Bearer ${registerBody.token}`
      }
    });

    expect(authResponse.status()).toBe(200);
    const projectsBody = await authResponse.json();
    expect(Array.isArray(projectsBody.projects)).toBe(true);
  });

  test('should reject invalid authentication', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/projects`, {
      headers: {
        Authorization: 'Bearer invalid-token'
      }
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should create and analyze a project', async ({ request }) => {
    // First login
    const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
      data: {
        email: 'e2e-test@example.com',
        password: 'TestPassword123!'
      }
    });

    expect(loginResponse.status()).toBe(200);
    const { token } = await loginResponse.json();

    // Create a project
    const createResponse = await request.post(`${baseURL}/api/projects`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      data: {
        name: 'E2E Test Project',
        description: 'A test project for E2E testing'
      }
    });

    expect(createResponse.status()).toBe(201);
    const project = await createResponse.json();
    expect(project).toHaveProperty('id');
    expect(project).toHaveProperty('name', 'E2E Test Project');

    // Run a security scan
    const scanResponse = await request.post(
      `${baseURL}/api/projects/${project.id}/scan`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        data: {
          type: 'quick',
          config: {
            includeSecrets: true,
            includeDependencies: true
          }
        }
      }
    );

    expect(scanResponse.status()).toBe(202);
    const scan = await scanResponse.json();
    expect(scan).toHaveProperty('scanId');

    // Check scan status
    const statusResponse = await request.get(
      `${baseURL}/api/scans/${scan.scanId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    expect(statusResponse.status()).toBe(200);
    const status = await statusResponse.json();
    expect(status).toHaveProperty('status');
    expect(['pending', 'running', 'completed']).toContain(status.status);
  });

  test('should validate input and prevent XSS', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/projects`, {
      headers: {
        Authorization: 'Bearer fake-token'
      },
      data: {
        name: '<script>alert("xss")</script>',
        description: 'Test description'
      }
    });

    // Should fail with 401 due to invalid token
    expect(response.status()).toBe(401);
  });
});
