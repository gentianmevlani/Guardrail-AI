/**
 * API Endpoint Tracker
 * 
 * Tracks API endpoints in real-time as they're created
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface APIEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  fullPath: string; // e.g., /api/v1/users
  filePath: string; // File where endpoint is defined
  handler: string; // Function name
  params?: string[];
  queryParams?: string[];
  bodySchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  middleware?: string[];
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface APIRegistry {
  endpoints: APIEndpoint[];
  basePaths: string[]; // e.g., ['/api/v1', '/api/v2']
  lastUpdated: string;
}

class APIEndpointTracker {
  private registry: APIRegistry;
  private registryPath: string;
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.registryPath = path.join(projectPath, '.guardrail', 'api-registry.json');
    this.registry = this.loadRegistry();
  }

  /**
   * Register a new API endpoint
   */
  registerEndpoint(
    method: APIEndpoint['method'],
    path: string,
    filePath: string,
    handler: string,
    options: {
      params?: string[];
      queryParams?: string[];
      bodySchema?: any;
      responseSchema?: any;
      middleware?: string[];
      description?: string;
    } = {}
  ): APIEndpoint {
    // Normalize path
    const normalizedPath = this.normalizePath(path);
    const fullPath = this.buildFullPath(normalizedPath);

    // Check if endpoint already exists
    const existing = this.registry.endpoints.find(
      e => e.method === method && e.fullPath === fullPath
    );

    const endpoint: APIEndpoint = {
      id: existing?.id || this.generateId(),
      method,
      path: normalizedPath,
      fullPath,
      filePath: path.relative(this.projectPath, filePath),
      handler,
      params: options.params,
      queryParams: options.queryParams,
      bodySchema: options.bodySchema,
      responseSchema: options.responseSchema,
      middleware: options.middleware,
      description: options.description,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update or add endpoint
    if (existing) {
      const index = this.registry.endpoints.indexOf(existing);
      this.registry.endpoints[index] = endpoint;
    } else {
      this.registry.endpoints.push(endpoint);
    }

    // Update base paths
    this.updateBasePaths(fullPath);

    // Save registry
    this.saveRegistry();

    return endpoint;
  }

  /**
   * Get all endpoints
   */
  getEndpoints(): APIEndpoint[] {
    return this.registry.endpoints;
  }

  /**
   * Find endpoint by path and method
   */
  findEndpoint(method: APIEndpoint['method'], path: string): APIEndpoint | undefined {
    const normalizedPath = this.normalizePath(path);
    const fullPath = this.buildFullPath(normalizedPath);
    
    return this.registry.endpoints.find(
      e => e.method === method && e.fullPath === fullPath
    );
  }

  /**
   * Get endpoints by base path
   */
  getEndpointsByBasePath(basePath: string): APIEndpoint[] {
    return this.registry.endpoints.filter(e => e.fullPath.startsWith(basePath));
  }

  /**
   * Validate API path exists
   */
  validatePath(method: APIEndpoint['method'], path: string): {
    valid: boolean;
    endpoint?: APIEndpoint;
    suggestions?: string[];
  } {
    const endpoint = this.findEndpoint(method, path);
    
    if (endpoint) {
      return { valid: true, endpoint };
    }

    // Find similar paths
    const suggestions = this.registry.endpoints
      .filter(e => e.method === method)
      .map(e => e.fullPath)
      .filter(p => this.pathSimilarity(path, p) > 0.5)
      .slice(0, 5);

    return { valid: false, suggestions };
  }

  /**
   * Get API base paths
   */
  getBasePaths(): string[] {
    return this.registry.basePaths;
  }

  /**
   * Generate frontend API client code
   */
  generateAPIClient(basePath: string = '/api/v1'): string {
    const endpoints = this.getEndpointsByBasePath(basePath);
    
    let code = `// Auto-generated API client\n`;
    code += `// Base path: ${basePath}\n\n`;
    code += `const API_BASE = '${basePath}';\n\n`;

    endpoints.forEach(endpoint => {
      const functionName = this.endpointToFunctionName(endpoint);
      const params = endpoint.params || [];
      const queryParams = endpoint.queryParams || [];
      
      code += `export async function ${functionName}(`;
      
      // Add path params
      if (params.length > 0) {
        code += `params: { ${params.map(p => `${p}: string`).join(', ')} }, `;
      }
      
      // Add query params
      if (queryParams.length > 0) {
        code += `query?: { ${queryParams.map(q => `${q}?: string`).join(', ')} }, `;
      }
      
      // Add body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        code += `body?: any, `;
      }
      
      code = code.replace(/, $/, '');
      code += `) {\n`;
      
      // Build URL
      let url = `\`\${API_BASE}${endpoint.path}\``;
      if (params.length > 0) {
        params.forEach(p => {
          url = url.replace(`:${p}`, `\${params.${p}}`);
        });
      }
      
      code += `  const url = ${url};\n`;
      
      // Add query string
      if (queryParams.length > 0) {
        code += `  const searchParams = new URLSearchParams();\n`;
        code += `  if (query) {\n`;
        queryParams.forEach(q => {
          code += `    if (query.${q}) searchParams.append('${q}', query.${q});\n`;
        });
        code += `  }\n`;
        code += `  const finalUrl = url + (searchParams.toString() ? '?' + searchParams.toString() : '');\n`;
      } else {
        code += `  const finalUrl = url;\n`;
      }
      
      // Make request
      code += `  const response = await fetch(finalUrl, {\n`;
      code += `    method: '${endpoint.method}',\n`;
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        code += `    headers: { 'Content-Type': 'application/json' },\n`;
        code += `    body: body ? JSON.stringify(body) : undefined,\n`;
      }
      code += `  });\n`;
      code += `  return response.json();\n`;
      code += `}\n\n`;
    });

    return code;
  }

  // Private methods
  private normalizePath(path: string): string {
    // Remove leading/trailing slashes, ensure starts with /
    return '/' + path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
  }

  private buildFullPath(path: string): string {
    // If path already includes /api, use as-is
    if (path.startsWith('/api')) {
      return path;
    }
    
    // Otherwise, prepend default base path
    return `/api/v1${path}`;
  }

  private updateBasePaths(fullPath: string): void {
    // Extract base path (e.g., /api/v1 from /api/v1/users)
    const match = fullPath.match(/^(\/api\/v\d+)/);
    if (match && !this.registry.basePaths.includes(match[1])) {
      this.registry.basePaths.push(match[1]);
      this.registry.basePaths.sort();
    }
  }

  private endpointToFunctionName(endpoint: APIEndpoint): string {
    // Convert /api/v1/users/:id to getUserById
    const parts = endpoint.path.split('/').filter(p => p && !p.startsWith(':'));
    const lastPart = parts[parts.length - 1] || 'item';
    
    let name = '';
    if (endpoint.method === 'GET') {
      name = parts.length > 1 ? `get${this.capitalize(lastPart)}` : `get${this.capitalize(lastPart)}s`;
    } else if (endpoint.method === 'POST') {
      name = `create${this.capitalize(lastPart)}`;
    } else if (endpoint.method === 'PUT' || endpoint.method === 'PATCH') {
      name = `update${this.capitalize(lastPart)}`;
    } else if (endpoint.method === 'DELETE') {
      name = `delete${this.capitalize(lastPart)}`;
    }
    
    return name;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private pathSimilarity(path1: string, path2: string): number {
    // Simple similarity based on common segments
    const segments1 = path1.split('/').filter(s => s);
    const segments2 = path2.split('/').filter(s => s);
    
    const common = segments1.filter(s => segments2.includes(s)).length;
    const total = Math.max(segments1.length, segments2.length);
    
    return total > 0 ? common / total : 0;
  }

  private loadRegistry(): APIRegistry {
    try {
      if (fs.existsSync(this.registryPath)) {
        const data = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
        return data;
      }
    } catch (error) {
      // Failed to process - continue with other operations
    }

    return {
      endpoints: [],
      basePaths: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  private saveRegistry(): void {
    try {
      const dir = path.dirname(this.registryPath);
      fs.mkdirSync(dir, { recursive: true });
      this.registry.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 2));
    } catch (error) {
      console.error('Failed to save API registry:', error);
    }
  }

  private generateId(): string {
    return `endpoint-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }
}

export const apiEndpointTracker = new APIEndpointTracker();

