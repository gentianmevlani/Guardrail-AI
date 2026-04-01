/**
 * API Endpoint Validator
 * 
 * Prevents AI agents from using mock data or fake endpoints.
 * All API calls must reference real, registered endpoints.
 */

interface RegisteredEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description?: string;
}

class ApiValidator {
  private registeredEndpoints: Map<string, RegisteredEndpoint> = new Map();
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.loadRegisteredEndpoints();
  }

  /**
   * Load registered endpoints from configuration
   * This should be populated from your actual API routes
   */
  private loadRegisteredEndpoints(): void {
    // This will be populated by the setup script or manually
    // Example endpoints - replace with your actual API structure
    const endpoints: RegisteredEndpoint[] = [
      // Add your actual endpoints here
      // { path: '/api/users', method: 'GET' },
      // { path: '/api/users', method: 'POST' },
      // { path: '/api/users/[id]', method: 'GET' },
    ];

    endpoints.forEach((endpoint) => {
      const key = `${endpoint.method}:${endpoint.path}`;
      this.registeredEndpoints.set(key, endpoint);
    });
  }

  /**
   * Register a new API endpoint
   * Call this when creating new API routes
   */
  public registerEndpoint(endpoint: RegisteredEndpoint): void {
    const key = `${endpoint.method}:${endpoint.path}`;
    this.registeredEndpoints.set(key, endpoint);
    
    if (this.isDevelopment) {
      console.log(`✅ Registered endpoint: ${endpoint.method} ${endpoint.path}`);
    }
  }

  /**
   * Validate that an endpoint exists before making a request
   */
  public validateEndpoint(path: string, method: string): boolean {
    // Normalize path (remove query params, handle dynamic routes)
    const normalizedPath = this.normalizePath(path);
    const key = `${method.toUpperCase()}:${normalizedPath}`;

    // Check exact match
    if (this.registeredEndpoints.has(key)) {
      return true;
    }

    // Check for dynamic route matches (e.g., /api/users/[id])
    for (const [registeredKey, endpoint] of this.registeredEndpoints.entries()) {
      if (this.matchesDynamicRoute(endpoint.path, normalizedPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Normalize API path for comparison
   */
  private normalizePath(path: string): string {
    // Remove query parameters
    const url = new URL(path, 'http://localhost');
    let normalized = url.pathname;

    // Remove leading/trailing slashes
    normalized = normalized.replace(/^\/+|\/+$/g, '');

    // Replace UUIDs and numeric IDs with [id] pattern
    normalized = normalized.replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/[id]'
    );
    normalized = normalized.replace(/\/\d+/g, '/[id]');

    return `/${normalized}`;
  }

  /**
   * Check if a path matches a dynamic route pattern
   */
  private matchesDynamicRoute(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      // Match dynamic segments like [id], [slug], etc.
      if (patternPart.startsWith('[') && patternPart.endsWith(']')) {
        continue; // This segment matches any value
      }

      if (patternPart !== pathPart) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all registered endpoints (for debugging/validation)
   */
  public getRegisteredEndpoints(): RegisteredEndpoint[] {
    return Array.from(this.registeredEndpoints.values());
  }

  /**
   * Check for common mock data patterns
   */
  public static detectMockData(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const str = JSON.stringify(data).toLowerCase();

    // Common mock data indicators
    const mockPatterns = [
      'lorem ipsum',
      'mock',
      'fake',
      'dummy',
      'test data',
      'example.com',
      'placeholder',
      'sample',
    ];

    return mockPatterns.some((pattern) => str.includes(pattern));
  }
}

// Singleton instance
export const apiValidator = new ApiValidator();

/**
 * Decorator/helper to validate API calls
 */
export function validateApiCall(
  path: string,
  method: string = 'GET'
): void {
  if (process.env.NODE_ENV === 'production') {
    // In production, we might want to be more lenient
    return;
  }

  const isValid = apiValidator.validateEndpoint(path, method);

  if (!isValid) {
    const error = new Error(
      `❌ UNREGISTERED API ENDPOINT: ${method} ${path}\n` +
        `This endpoint is not registered. Please:\n` +
        `1. Create the actual API route first\n` +
        `2. Register it using apiValidator.registerEndpoint()\n` +
        `3. Never use mock data or fake endpoints`
    );
    
    console.error(error);
    
    // In development, throw to catch issues early
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }
  }
}

/**
 * Wrapper for fetch that validates endpoints
 */
export async function validatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  const method = init?.method || 'GET';

  validateApiCall(url, method);

  // Check response for mock data
  const response = await fetch(input, init);
  const clonedResponse = response.clone();

  try {
    const data = await clonedResponse.json();
    if (ApiValidator.detectMockData(data)) {
      console.warn(
        `⚠️  WARNING: Response may contain mock data: ${url}\n` +
          `Ensure you're using real API endpoints, not mock data.`
      );
    }
  } catch {
    // Not JSON, skip mock data check
  }

  return response;
}

