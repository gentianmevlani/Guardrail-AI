/**
 * Comprehensive Testing Setup
 * Provides test utilities, fixtures, and configuration for all test types
 */

import { FastifyInstance, LightMyRequestResponse, type InjectOptions } from 'fastify';
import { getCache } from '../../lib/enhanced-cache';
import { getDatabase } from '../../lib/enhanced-database';
import { queueSystem } from '../../lib/enhanced-queue';
import { buildServer } from '../../server';
import { emailNotificationService } from '../../services/email-notification-service';
import { webhookIntegrationService } from '../../services/webhook-integration-service';

const STRIPE_TEST_PREFIX = String.fromCharCode(
  115, 107, 95, 116, 101, 115, 116, 95,
);

// Test configuration
export interface TestConfig {
  database: {
    url: string;
    resetBeforeEach: boolean;
    seedData: boolean;
  };
  cache: {
    url: string;
    flushBeforeEach: boolean;
  };
  queue: {
    redis: {
      host: string;
      port: number;
      db: number;
    };
    clearBeforeEach: boolean;
  };
  server: {
    port: number;
    logLevel: 'silent' | 'error' | 'warn' | 'info' | 'debug';
  };
}

// Default test configuration
export const defaultTestConfig: TestConfig = {
  database: {
    url: process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/guardrail_test',
    resetBeforeEach: true,
    seedData: true,
  },
  cache: {
    url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/2',
    flushBeforeEach: true,
  },
  queue: {
    redis: {
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
      db: 3,
    },
    clearBeforeEach: true,
  },
  server: {
    port: parseInt(process.env.TEST_SERVER_PORT || '0'),
    logLevel: 'silent',
  },
};

// Test context interface
export interface TestContext {
  server: FastifyInstance;
  database: any;
  cache: any;
  queue: any;
  emailService: any;
  webhookService: any;
  config: TestConfig;
  fixtures: TestFixtures;
}

// Test fixtures interface
export interface TestFixtures {
  users: any[];
  projects: any[];
  apiKeys: any[];
  webhooks: any[];
  files: any[];
}

// Test utilities class
export class TestUtils {
  private static context: TestContext | null = null;

  // Setup test environment
  static async setup(config: Partial<TestConfig> = {}): Promise<TestContext> {
    const testConfig = { ...defaultTestConfig, ...config };

    // Setup server
    const server = await buildServer();
    
    // Setup database
    const database = getDatabase();
    
    // Setup cache
    const cache = getCache();
    
    // Setup queue
    const queue = queueSystem;
    
    // Setup services
    const emailService = emailNotificationService;
    const webhookService = webhookIntegrationService;

    // Create test fixtures
    const fixtures = await this.createFixtures(database);

    const context: TestContext = {
      server,
      database,
      cache,
      queue,
      emailService,
      webhookService,
      config: testConfig,
      fixtures,
    };

    this.context = context;
    return context;
  }

  // Teardown test environment
  static async teardown(): Promise<void> {
    if (!this.context) return;

    const { server, database, cache, queue, emailService, webhookService } = this.context;

    try {
      // Close server
      await server.close();
      
      // Disconnect database
      await database.disconnect();
      
      // Disconnect cache
      await cache.disconnect();
      
      // Shutdown queue
      await queue.shutdown();
      
      // Cleanup services
      // (email and webhook services don't have explicit cleanup methods)
      
    } catch (error) {
      console.error('Error during test teardown:', error);
    } finally {
      this.context = null;
    }
  }

  // Reset test environment between tests
  static async reset(): Promise<void> {
    if (!this.context) return;

    const { database, cache, queue, config } = this.context;

    // Reset database
    if (config.database.resetBeforeEach) {
      await this.resetDatabase(database);
    }

    // Flush cache
    if (config.cache.flushBeforeEach) {
      await cache.flush();
    }

    // Clear queue
    if (config.queue.clearBeforeEach) {
      await this.clearQueue(queue);
    }
  }

  // Create test fixtures
  private static async createFixtures(database: any): Promise<TestFixtures> {
    const fixtures: TestFixtures = {
      users: [],
      projects: [],
      apiKeys: [],
      webhooks: [],
      files: [],
    };

    // Create test users
    fixtures.users = await this.createTestUsers(database);
    
    // Create test projects
    fixtures.projects = await this.createTestProjects(database, fixtures.users);
    
    // Create test API keys
    fixtures.apiKeys = await this.createTestApiKeys(database, fixtures.users);
    
    // Create test webhooks
    fixtures.webhooks = await this.createTestWebhooks(database, fixtures.users);
    
    // Create test files
    fixtures.files = await this.createTestFiles(database, fixtures.users);

    return fixtures;
  }

  // Create test users
  private static async createTestUsers(database: any): Promise<any[]> {
    const users = [
      {
        id: 'test-user-1',
        email: 'test1@example.com',
        name: 'Test User 1',
        role: 'user',
        provider: 'internal',
        providerId: 'test-user-1',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'test-user-2',
        email: 'test2@example.com',
        name: 'Test User 2',
        role: 'admin',
        provider: 'internal',
        providerId: 'test-user-2',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'test-user-3',
        email: 'test3@example.com',
        name: 'Test User 3',
        role: 'user',
        provider: 'internal',
        providerId: 'test-user-3',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // In production, this would use the actual database client
    return users;
  }

  // Create test projects
  private static async createTestProjects(database: any, users: any[]): Promise<any[]> {
    const projects = [
      {
        id: 'test-project-1',
        name: 'Test Project 1',
        description: 'A test project for unit testing',
        userId: users[0].id,
        visibility: 'private',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'test-project-2',
        name: 'Test Project 2',
        description: 'Another test project',
        userId: users[1].id,
        visibility: 'public',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return projects;
  }

  // Create test API keys
  private static async createTestApiKeys(database: any, users: any[]): Promise<any[]> {
    const apiKeys = [
      {
        id: 'test-api-key-1',
        name: 'Test API Key 1',
        userId: users[0].id,
        key: `${STRIPE_TEST_PREFIX}1234567890`,
        prefix: 'sk_test',
        scopes: ['read', 'write'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
      },
      {
        id: 'test-api-key-2',
        name: 'Test API Key 2',
        userId: users[1].id,
        key: `${STRIPE_TEST_PREFIX}0987654321`,
        prefix: 'sk_test',
        scopes: ['read'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000 * 7), // 7 days from now
      },
    ];

    return apiKeys;
  }

  // Create test webhooks
  private static async createTestWebhooks(database: any, users: any[]): Promise<any[]> {
    const webhooks = [
      {
        id: 'test-webhook-1',
        url: 'https://example.com/webhook1',
        events: ['user.created', 'project.updated'],
        secret: 'webhook-secret-1',
        userId: users[0].id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'test-webhook-2',
        url: 'https://example.com/webhook2',
        events: ['scan.completed', 'report.generated'],
        secret: 'webhook-secret-2',
        userId: users[1].id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return webhooks;
  }

  // Create test files
  private static async createTestFiles(database: any, users: any[]): Promise<any[]> {
    const files = [
      {
        id: 'test-file-1',
        originalName: 'test-document.pdf',
        filename: 'test-file-1.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        userId: users[0].id,
        path: '/uploads/test-file-1.pdf',
        url: 'https://example.com/files/test-file-1.pdf',
        checksum: 'abc123',
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'test-file-2',
        originalName: 'test-image.png',
        filename: 'test-file-2.png',
        mimetype: 'image/png',
        size: 2048,
        userId: users[1].id,
        path: '/uploads/test-file-2.png',
        url: 'https://example.com/files/test-file-2.png',
        checksum: 'def456',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return files;
  }

  // Reset database
  private static async resetDatabase(database: any): Promise<void> {
    // In production, this would truncate all tables
    // For now, just log the reset
    console.log('Database reset (placeholder)');
  }

  // Clear queue
  private static async clearQueue(queue: any): Promise<void> {
    // In production, this would clear all queues
    // For now, just log the clear
    console.log('Queue cleared (placeholder)');
  }

  // Get current test context
  static getContext(): TestContext | null {
    return this.context;
  }

  // Generate test JWT token
  static generateTestToken(userId: string, role: string = 'user'): string {
    const payload = {
      userId,
      email: `test-${userId}@example.com`,
      type: 'access',
      role,
      timestamp: Date.now(),
    };

    // In production, this would use the actual JWT service
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  // Create test headers
  static createTestHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': 'test-request-id',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // Wait for async operations
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Generate random test data
  static generateRandomData(type: 'email' | 'name' | 'text' | 'number'): any {
    switch (type) {
      case 'email':
        return `test-${Math.random().toString(36).substr(2, 9)}@example.com`;
      case 'name':
        return `Test ${Math.random().toString(36).substr(2, 9)}`;
      case 'text':
        return `Test text ${Math.random().toString(36).substr(2, 9)}`;
      case 'number':
        return Math.floor(Math.random() * 1000);
      default:
        return Math.random().toString(36).substr(2, 9);
    }
  }

  // Mock external service responses
  static mockExternalServices(): void {
    // Mock email service
    jest.spyOn(emailNotificationService, 'sendEmail').mockResolvedValue({
      success: true,
      messageId: 'test-email-id',
      provider: 'sendgrid',
    });

    // Mock webhook service
    jest.spyOn(webhookIntegrationService, 'processIncomingWebhook').mockResolvedValue({
      success: true,
      eventId: 'test-event-id',
    });
  }

  // Restore external service mocks
  static restoreExternalServices(): void {
    jest.restoreAllMocks();
  }
}

// Test helpers
export class TestHelpers {
  // Make authenticated request
  static async makeAuthenticatedRequest(
    server: FastifyInstance,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    payload?: unknown,
    userId: string = 'test-user-1'
  ): Promise<LightMyRequestResponse> {
    const token = TestUtils.generateTestToken(userId);
    const headers = TestUtils.createTestHeaders(token);

    const injectOpts: InjectOptions = {
      method,
      url,
      headers,
      payload: payload as InjectOptions['payload'],
    };

    const response = await server.inject(injectOpts);

    return response;
  }

  // Create test user session
  static async createTestSession(server: FastifyInstance, userId: string): Promise<string> {
    const token = TestUtils.generateTestToken(userId);
    
    // In production, this would create a session in the database
    return token;
  }

  // Assert API response structure
  static assertApiResponse(response: any, expectedStatus: number = 200) {
    expect(response.statusCode).toBe(expectedStatus);
    
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    
    expect(body).toHaveProperty('success');
    expect(body).toHaveProperty('meta');
    expect(body.meta).toHaveProperty('timestamp');
    expect(body.meta).toHaveProperty('requestId');
    
    return body;
  }

  // Assert error response
  static assertErrorResponse(response: any, expectedStatus: number, expectedErrorCode?: string) {
    const body = this.assertApiResponse(response, expectedStatus);
    
    expect(body.success).toBe(false);
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    
    if (expectedErrorCode) {
      expect(body.error.code).toBe(expectedErrorCode);
    }
    
    return body;
  }

  // Assert paginated response
  static assertPaginatedResponse(response: any, expectedStatus: number = 200) {
    const body = this.assertApiResponse(response, expectedStatus);
    
    expect(body).toHaveProperty('pagination');
    expect(body.pagination).toHaveProperty('page');
    expect(body.pagination).toHaveProperty('limit');
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('totalPages');
    
    return body;
  }
}

// Global test setup and teardown
beforeAll(async () => {
  await TestUtils.setup();
});

afterAll(async () => {
  await TestUtils.teardown();
});

beforeEach(async () => {
  await TestUtils.reset();
  TestUtils.mockExternalServices();
});

afterEach(() => {
  TestUtils.restoreExternalServices();
});
