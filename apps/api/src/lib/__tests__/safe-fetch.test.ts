import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkURLAllowed, getAllowlist, safeFetch, SSRFError, validateUserURL } from '../safe-fetch';

// Mock DNS resolution
vi.mock('dns', () => ({
  default: {
    promises: {
      resolve4: vi.fn(),
      resolve6: vi.fn(),
    },
  },
}));

const mockDns = await import('dns');

// Create a proper Response mock
function createMockResponse(overrides: Partial<Response> = {}): Response {
  const response = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"success": true}'));
        controller.close();
      },
    }),
    url: 'https://api.stripe.com',
    redirected: false,
    type: 'basic' as ResponseType,
    bodyUsed: false,
    clone: vi.fn(),
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    json: vi.fn(),
    text: vi.fn(),
    bytes: vi.fn(),
    ...overrides,
  } as Response;

  return response;
}

// Mock fetch globally
global.fetch = vi.fn();

describe('safe-fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllowlist', () => {
    it('should return default allowlist', () => {
      const allowlist = getAllowlist();
      expect(allowlist).toContain('api.stripe.com');
      expect(allowlist).toContain('api.github.com');
      expect(allowlist).toContain('api.openai.com');
    });
  });

  describe('validateUserURL', () => {
    it('should allow valid HTTPS URLs', () => {
      const result = validateUserURL('https://api.stripe.com/v1/charges');
      expect(result.valid).toBe(true);
    });

    it('should reject localhost', () => {
      const result = validateUserURL('http://localhost:3000/api');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Localhost not allowed');
    });

    it('should reject 127.0.0.1', () => {
      const result = validateUserURL('http://127.0.0.1:3000/api');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Localhost not allowed');
    });

    it('should reject 0.0.0.0', () => {
      const result = validateUserURL('http://0.0.0.0:3000/api');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Bind addresses not allowed');
    });

    it('should reject invalid URLs', () => {
      const result = validateUserURL('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid URL');
    });

    it('should reject non-HTTP protocols', () => {
      const result = validateUserURL('ftp://example.com');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Unsupported protocol');
    });

    it('should reject URLs with credentials', () => {
      const result = validateUserURL('https://user:pass@example.com');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('credentials');
    });
  });

  describe('checkURLAllowed', () => {
    beforeEach(() => {
      vi.mocked(mockDns.default.promises.resolve4).mockResolvedValue(['1.2.3.4']);
      vi.mocked(mockDns.default.promises.resolve6).mockRejectedValue(new Error('No IPv6'));
    });

    it('should allow allowlisted domains', async () => {
      const result = await checkURLAllowed('https://api.stripe.com/v1/charges');
      expect(result.allowed).toBe(true);
    });

    it('should reject non-allowlisted domains', async () => {
      const result = await checkURLAllowed('https://evil.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in allowlist');
    });

    it('should reject private IP addresses', async () => {
      vi.mocked(mockDns.default.promises.resolve4).mockResolvedValue(['192.168.1.1']);
      
      const result = await checkURLAllowed('https://internal.local');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('192.168/16');
    });

    it('should reject loopback addresses', async () => {
      vi.mocked(mockDns.default.promises.resolve4).mockResolvedValue(['127.0.0.1']);
      
      const result = await checkURLAllowed('https://localhost.local');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('127/8');
    });

    it('should reject link-local addresses', async () => {
      vi.mocked(mockDns.default.promises.resolve4).mockResolvedValue(['169.254.169.254']);
      
      const result = await checkURLAllowed('https://metadata.local');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('169.254/16');
    });

    it('should use custom allowlist', async () => {
      const result = await checkURLAllowed('https://custom-api.com', ['custom-api.com']);
      expect(result.allowed).toBe(true);
    });

    it('should handle DNS resolution failures', async () => {
      vi.mocked(mockDns.default.promises.resolve4).mockRejectedValue(new Error('DNS failed'));
      
      const result = await checkURLAllowed('https://nonexistent.com');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('DNS resolution failed');
    });
  });

  describe('safeFetch', () => {
    beforeEach(() => {
      vi.mocked(mockDns.default.promises.resolve4).mockResolvedValue(['1.2.3.4']);
      vi.mocked(mockDns.default.promises.resolve6).mockRejectedValue(new Error('No IPv6'));
    });

    it('should allow requests to allowlisted domains', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"success": true}'));
            controller.close();
          },
        }),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const result = await safeFetch('https://api.stripe.com/v1/charges');

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ success: true });
      expect(result.size).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should reject requests to non-allowlisted domains', async () => {
      await expect(safeFetch('https://evil.com')).rejects.toThrow(SSRFError);
    });

    it('should reject requests to private IPs', async () => {
      vi.mocked(mockDns.default.promises.resolve4).mockResolvedValue(['192.168.1.1']);

      await expect(safeFetch('https://internal.local')).rejects.toThrow(SSRFError);
    });

    it('should reject requests to localhost', async () => {
      vi.mocked(mockDns.default.promises.resolve4).mockResolvedValue(['127.0.0.1']);

      await expect(safeFetch('https://localhost')).rejects.toThrow(SSRFError);
    });

    it('should reject requests to metadata service', async () => {
      vi.mocked(mockDns.default.promises.resolve4).mockResolvedValue(['169.254.169.254']);

      await expect(safeFetch('https://metadata.local')).rejects.toThrow(SSRFError);
    });

    it('should handle timeouts', async () => {
      vi.mocked(global.fetch).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      await expect(
        safeFetch('https://api.stripe.com', { totalTimeout: 100 })
      ).rejects.toThrow(SSRFError);
    });

    it('should enforce response size limits', async () => {
      const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(largeData));
            controller.close();
          },
        }),
        url: 'https://api.stripe.com',
        redirected: false,
        type: 'basic' as ResponseType,
        clone: vi.fn(),
        arrayBuffer: vi.fn(),
        blob: vi.fn(),
        formData: vi.fn(),
        json: vi.fn(),
        text: vi.fn(),
      } as Response;

      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      await expect(
        safeFetch('https://api.stripe.com', { maxResponseSize: 10 * 1024 * 1024 })
      ).rejects.toThrow(SSRFError);
    });

    it('should handle JSON responses', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"key": "value"}'));
            controller.close();
          },
        }),
        url: 'https://api.stripe.com',
        redirected: false,
        type: 'basic' as ResponseType,
        clone: vi.fn(),
        arrayBuffer: vi.fn(),
        blob: vi.fn(),
        formData: vi.fn(),
        json: vi.fn(),
        text: vi.fn(),
      } as Response;

      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const result = await safeFetch('https://api.stripe.com');

      expect(result.data).toEqual({ key: 'value' });
    });

    it('should handle binary responses', async () => {
      const binaryData = new Uint8Array([1, 2, 3, 4, 5]);

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(binaryData);
            controller.close();
          },
        }),
        url: 'https://api.stripe.com',
        redirected: false,
        type: 'basic' as ResponseType,
        clone: vi.fn(),
        arrayBuffer: vi.fn(),
        blob: vi.fn(),
        formData: vi.fn(),
        json: vi.fn(),
        text: vi.fn(),
      } as Response;

      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const result = await safeFetch('https://api.stripe.com');

      expect(result.data).toEqual(binaryData);
    });

    it('should not follow redirects by default', async () => {
      const mockResponse = {
        ok: false,
        status: 302,
        statusText: 'Found',
        headers: new Headers({ location: 'https://evil.com' }),
        body: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        url: 'https://api.stripe.com',
        redirected: false,
        type: 'basic' as ResponseType,
        clone: vi.fn(),
        arrayBuffer: vi.fn(),
        blob: vi.fn(),
        formData: vi.fn(),
        json: vi.fn(),
        text: vi.fn(),
      } as Response;

      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const result = await safeFetch('https://api.stripe.com');

      expect(result.status).toBe(302);
      expect(result.ok).toBe(false);
    });

    it('should follow redirects when allowed', async () => {
      const redirectResponse = {
        ok: false,
        status: 302,
        statusText: 'Found',
        headers: new Headers({ location: 'https://api.stripe.com/v1/charges' }),
        body: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        url: 'https://api.stripe.com',
        redirected: false,
        type: 'basic' as ResponseType,
        clone: vi.fn(),
        arrayBuffer: vi.fn(),
        blob: vi.fn(),
        formData: vi.fn(),
        json: vi.fn(),
        text: vi.fn(),
      } as Response;

      const finalResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"success": true}'));
            controller.close();
          },
        }),
        url: 'https://api.stripe.com/v1/charges',
        redirected: false,
        type: 'basic' as ResponseType,
        clone: vi.fn(),
        arrayBuffer: vi.fn(),
        blob: vi.fn(),
        formData: vi.fn(),
        json: vi.fn(),
        text: vi.fn(),
      } as Response;

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(redirectResponse)
        .mockResolvedValueOnce(finalResponse);

      const result = await safeFetch('https://api.stripe.com', { maxRedirects: 1 });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ success: true });
    });

    it('should reject too many redirects', async () => {
      const redirectResponse = {
        ok: false,
        status: 302,
        statusText: 'Found',
        headers: new Headers({ location: 'https://api.stripe.com/redirect1' }),
        body: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        url: 'https://api.stripe.com',
        redirected: false,
        type: 'basic' as ResponseType,
        clone: vi.fn(),
        arrayBuffer: vi.fn(),
        blob: vi.fn(),
        formData: vi.fn(),
        json: vi.fn(),
        text: vi.fn(),
      } as Response;

      vi.mocked(global.fetch).mockResolvedValue(redirectResponse);

      await expect(
        safeFetch('https://api.stripe.com', { maxRedirects: 0 })
      ).rejects.toThrow(SSRFError);
    });

    it('should handle custom allowlist', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"success": true}'));
            controller.close();
          },
        }),
      };

      vi.mocked(global.fetch).mockResolvedValue(mockResponse);

      const result = await safeFetch('https://custom-api.com', {
        allowlist: ['custom-api.com'],
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('SSRF Error Handling', () => {
    it('should create SSRFError with correct properties', () => {
      const error = new SSRFError('Test message', 'TEST_REASON');
      
      expect(error.name).toBe('SSRFError');
      expect(error.message).toBe('Test message');
      expect(error.reason).toBe('TEST_REASON');
    });

    it('should preserve error stack', () => {
      const error = new SSRFError('Test message', 'TEST_REASON');
      
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('Wildcard Allowlist Matching', () => {
    beforeEach(() => {
      vi.mocked(mockDns.default.promises.resolve4).mockResolvedValue(['1.2.3.4']);
      vi.mocked(mockDns.default.promises.resolve6).mockRejectedValue(new Error('No IPv6'));
    });

    it('should match exact domain', async () => {
      const result = await checkURLAllowed('https://api.example.com', ['api.example.com']);
      expect(result.allowed).toBe(true);
    });

    it('should match wildcard subdomain', async () => {
      const result = await checkURLAllowed('https://sub.api.example.com', ['*.example.com']);
      expect(result.allowed).toBe(true);
    });

    it('should match domain with wildcard', async () => {
      const result = await checkURLAllowed('https://example.com', ['*.example.com']);
      expect(result.allowed).toBe(true);
    });

    it('should not match different domain', async () => {
      const result = await checkURLAllowed('https://evil.com', ['*.example.com']);
      expect(result.allowed).toBe(false);
    });
  });
});
