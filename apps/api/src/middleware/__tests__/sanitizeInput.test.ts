import { describe, it, expect } from 'vitest';
import { sanitizeInput } from '../sanitizeInput';
import { FastifyRequest, FastifyReply } from 'fastify';

describe('sanitizeInput middleware', () => {
  it('should sanitize HTML tags in request body', async () => {
    const request = {
      body: {
        text: '<script>alert("xss")</script>',
        nested: {
          inner: '<b>hello</b>'
        }
      }
    } as any as FastifyRequest;

    await sanitizeInput(request, {} as FastifyReply);

    expect(request.body).toEqual({
      text: '', // script tags stripped entirely
      nested: {
        inner: '&lt;b&gt;hello&lt;/b&gt;'
      }
    });
  });

  it('should escape SQL-like patterns in request body', async () => {
    const request = {
      body: {
        query: "user'; DROP TABLE users;--"
      }
    } as any as FastifyRequest;

    await sanitizeInput(request, {} as FastifyReply);

    const body = request.body as any;
    expect(body.query).toContain("user&#x27;  DROP TABLE users __");
  });

  it('should handle arrays in request body', async () => {
    const request = {
      body: [
        "<img src=x onerror=alert(1)>",
        { dangerous: "' OR '1'='1" }
      ]
    } as any as FastifyRequest;

    await sanitizeInput(request, {} as FastifyReply);

    const body = request.body as any;
    expect(body[0]).toEqual("&lt;img src=x &gt;"); // onerror stripped
    expect(body[1].dangerous).toEqual("&#x27; OR &#x27;1&#x27;=&#x27;1");
  });

  it('should not modify non-string values', async () => {
    const request = {
      body: {
        count: 123,
        active: true,
        data: null
      }
    } as any as FastifyRequest;

    await sanitizeInput(request, {} as FastifyReply);

    expect(request.body).toEqual({
      count: 123,
      active: true,
      data: null
    });
  });

  it('should handle missing body', async () => {
    const request = {} as FastifyRequest;
    await expect(sanitizeInput(request, {} as FastifyReply)).resolves.not.toThrow();
  });
});
