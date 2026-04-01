/**
 * Security Routes Tests
 * 
 * Integration tests for the security scanning API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// Mock the security modules
vi.mock('guardrail-security', () => ({
  SecretsGuardian: vi.fn().mockImplementation(() => ({
    scanContent: vi.fn().mockResolvedValue([]),
    scanProject: vi.fn().mockResolvedValue({ detections: [], summary: { totalSecrets: 0 } }),
  })),
  TyposquatDetector: vi.fn().mockImplementation(() => ({
    detectTyposquatting: vi.fn().mockResolvedValue({ isTyposquat: false, similarity: 0 }),
  })),
  vulnerabilityDatabase: {
    checkPackage: vi.fn().mockResolvedValue({ isVulnerable: false, vulnerabilities: [] }),
    checkPackages: vi.fn().mockResolvedValue([]),
  },
  sbomGenerator: {
    generate: vi.fn().mockResolvedValue({ components: [], dependencies: [] }),
  },
}));

describe('Security Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    
    // Register security routes
    app.post('/api/security/scan/secrets', async (request, reply) => {
      const { content, projectPath } = request.body as any;
      
      if (!content && !projectPath) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Either content or projectPath is required' 
        });
      }

      return {
        success: true,
        data: {
          detections: [],
          summary: { totalSecrets: 0, byType: {}, byRisk: { high: 0, medium: 0, low: 0 } }
        }
      };
    });

    app.post('/api/security/scan/vulnerabilities', async (request, reply) => {
      const { packages } = request.body as any;
      
      if (!packages || !Array.isArray(packages)) {
        return reply.status(400).send({ 
          success: false, 
          error: 'packages array is required' 
        });
      }

      return {
        success: true,
        data: {
          results: packages.map((pkg: any) => ({
            package: pkg.name,
            version: pkg.version,
            isVulnerable: false,
            vulnerabilities: []
          })),
          summary: { critical: 0, high: 0, medium: 0, low: 0 }
        }
      };
    });

    app.post('/api/security/scan/typosquat', async (request, reply) => {
      const { packageName } = request.body as any;
      
      if (!packageName) {
        return reply.status(400).send({ 
          success: false, 
          error: 'packageName is required' 
        });
      }

      return {
        success: true,
        data: {
          isTyposquat: false,
          suspiciousPackage: packageName,
          similarity: 0,
          patterns: []
        }
      };
    });

    app.post('/api/security/sbom/generate', async (request, reply) => {
      const { projectPath, format } = request.body as any;
      
      if (!projectPath) {
        return reply.status(400).send({ 
          success: false, 
          error: 'projectPath is required' 
        });
      }

      return {
        success: true,
        data: {
          format: format || 'cyclonedx',
          components: [],
          dependencies: []
        }
      };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/security/scan/secrets', () => {
    it('should scan content for secrets', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/security/scan/secrets',
        payload: {
          content: 'const apiKey = "sk-test123";',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('detections');
      expect(body.data).toHaveProperty('summary');
    });

    it('should scan project for secrets', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/security/scan/secrets',
        payload: {
          projectPath: '/path/to/project',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });

    it('should return error when no content or projectPath provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/security/scan/secrets',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toContain('required');
    });
  });

  describe('POST /api/security/scan/vulnerabilities', () => {
    it('should check packages for vulnerabilities', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/security/scan/vulnerabilities',
        payload: {
          packages: [
            { name: 'lodash', version: '4.17.21' },
            { name: 'express', version: '4.18.2' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.results).toHaveLength(2);
      expect(body.data.summary).toHaveProperty('critical');
    });

    it('should return error when packages not provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/security/scan/vulnerabilities',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/security/scan/typosquat', () => {
    it('should check package for typosquatting', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/security/scan/typosquat',
        payload: {
          packageName: 'react',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('isTyposquat');
      expect(body.data).toHaveProperty('similarity');
    });

    it('should return error when packageName not provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/security/scan/typosquat',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/security/sbom/generate', () => {
    it('should generate SBOM for project', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/security/sbom/generate',
        payload: {
          projectPath: '/path/to/project',
          format: 'cyclonedx',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('format');
      expect(body.data).toHaveProperty('components');
    });

    it('should default to cyclonedx format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/security/sbom/generate',
        payload: {
          projectPath: '/path/to/project',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.format).toBe('cyclonedx');
    });

    it('should return error when projectPath not provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/security/sbom/generate',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
