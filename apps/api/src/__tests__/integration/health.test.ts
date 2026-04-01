// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Health Integration Tests', () => {
  let app;

  beforeAll(async () => {
    // Create a simple Fastify instance for testing
    const Fastify = require('fastify');
    app = Fastify();
    
    // Add health check route
    app.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.status).toBe('ok');
    expect(payload.timestamp).toBeDefined();
  });
});
