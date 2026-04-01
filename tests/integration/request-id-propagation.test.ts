/**
 * Integration test for request ID propagation
 * 
 * Verifies that request IDs are generated and propagated through the API
 */

import Fastify from 'fastify';
import { addRequestId } from '../../apps/api/src/middleware/telemetry';

describe('Request ID Propagation', () => {
  let fastify: any;

  beforeEach(async () => {
    fastify = Fastify({ logger: false });
    fastify.addHook('onRequest', addRequestId);
    
    fastify.get('/test', async (request: any, reply: any) => {
      return { requestId: request.requestId };
    });

    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should generate request ID when not provided', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.requestId).toBeDefined();
    expect(body.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    expect(response.headers['x-request-id']).toBe(body.requestId);
  });

  it('should use provided request ID from header', async () => {
    const customRequestId = 'custom-req-123';

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-request-id': customRequestId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.requestId).toBe(customRequestId);
    expect(response.headers['x-request-id']).toBe(customRequestId);
  });

  it('should include request ID in error responses', async () => {
    fastify.get('/error', async () => {
      throw new Error('Test error');
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/error',
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers['x-request-id']).toBeDefined();
  });
});
