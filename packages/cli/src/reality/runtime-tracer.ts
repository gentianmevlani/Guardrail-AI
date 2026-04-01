/**
 * Runtime Tracer
 * 
 * Collects runtime traces during execution:
 * - HTTP requests made
 * - Routes hit
 * - Database queries executed
 */

export interface RuntimeTrace {
  requests: Array<{
    method: string;
    url: string;
    statusCode: number;
    timestamp: string;
    duration: number;
    headers?: Record<string, string>;
  }>;
  routes: Array<{
    path: string;
    method: string;
    hit: boolean;
    timestamp: string;
    responseTime?: number;
  }>;
  dbQueries: Array<{
    query: string;
    duration: number;
    timestamp: string;
    table?: string;
  }>;
}

class RuntimeTracer {
  private traces: RuntimeTrace = {
    requests: [],
    routes: [],
    dbQueries: [],
  };

  /**
   * Record an HTTP request
   */
  recordRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    headers?: Record<string, string>
  ): void {
    this.traces.requests.push({
      method,
      url,
      statusCode,
      timestamp: new Date().toISOString(),
      duration,
      headers,
    });
  }

  /**
   * Record a route hit
   */
  recordRoute(
    path: string,
    method: string,
    hit: boolean,
    responseTime?: number
  ): void {
    this.traces.routes.push({
      path,
      method,
      hit,
      timestamp: new Date().toISOString(),
      responseTime,
    });
  }

  /**
   * Record a database query
   */
  recordDbQuery(
    query: string,
    duration: number,
    table?: string
  ): void {
    this.traces.dbQueries.push({
      query: query.length > 200 ? query.substring(0, 200) + '...' : query, // Truncate long queries
      duration,
      timestamp: new Date().toISOString(),
      table,
    });
  }

  /**
   * Get all traces
   */
  getTraces(): RuntimeTrace {
    return { ...this.traces };
  }

  /**
   * Reset traces
   */
  reset(): void {
    this.traces = {
      requests: [],
      routes: [],
      dbQueries: [],
    };
  }
}

// Singleton instance
export const runtimeTracer = new RuntimeTracer();

/**
 * Playwright request interceptor for tracing HTTP requests
 */
export function createRequestInterceptor() {
  return (request: any) => {
    const startTime = Date.now();
    
    request.continue().then(() => {
      // Request completed
    });
  };
}

/**
 * Playwright response interceptor for tracing HTTP responses
 */
export function createResponseInterceptor() {
  return async (response: any) => {
    const request = response.request();
    const endTime = Date.now();
    const startTime = (request as any)._startTime || endTime;
    const duration = endTime - startTime;
    
    runtimeTracer.recordRequest(
      request.method(),
      request.url(),
      response.status(),
      duration,
      response.headers()
    );
  };
}

/**
 * Extract routes from Playwright trace or network logs
 */
export function extractRoutesFromTrace(tracePath: string): Array<{
  path: string;
  method: string;
  hit: boolean;
  timestamp: string;
  responseTime?: number;
}> {
  // This would parse Playwright trace files
  // For now, return empty array - implementation would parse trace.zip
  return [];
}
