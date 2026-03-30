/**
 * API Endpoint Tracker
 * 
 * Tracks API endpoints in real-time as they're created
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class APIEndpointTracker {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
    this.registryPath = path.join(projectPath, '.guardrail', 'api-registry.json');
    this.registry = this.loadRegistry();
  }

  /**
   * Register a new API endpoint
   */
  registerEndpoint(method, path, filePath, handler, options = {}) {
    const normalizedPath = this.normalizePath(path);
    const fullPath = this.buildFullPath(normalizedPath);

    const existing = this.registry.endpoints.find(
      e => e.method === method && e.fullPath === fullPath
    );

    const endpoint = {
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

    if (existing) {
      const index = this.registry.endpoints.indexOf(existing);
      this.registry.endpoints[index] = endpoint;
    } else {
      this.registry.endpoints.push(endpoint);
    }

    this.updateBasePaths(fullPath);
    this.saveRegistry();

    return endpoint;
  }

  /**
   * Get all endpoints
   */
  getEndpoints() {
    return this.registry.endpoints;
  }

  /**
   * Find endpoint by path and method
   */
  findEndpoint(method, path) {
    const normalizedPath = this.normalizePath(path);
    const fullPath = this.buildFullPath(normalizedPath);
    
    return this.registry.endpoints.find(
      e => e.method === method && e.fullPath === fullPath
    );
  }

  /**
   * Get endpoints by base path
   */
  getEndpointsByBasePath(basePath) {
    return this.registry.endpoints.filter(e => e.fullPath.startsWith(basePath));
  }

  /**
   * Validate API path exists
   */
  validatePath(method, path) {
    const endpoint = this.findEndpoint(method, path);
    
    if (endpoint) {
      return { valid: true, endpoint };
    }

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
  getBasePaths() {
    return this.registry.basePaths;
  }

  /**
   * Generate frontend API client code
   */
  generateAPIClient(basePath = '/api/v1') {
    const endpoints = this.getEndpointsByBasePath(basePath);
    
    let code = `// Auto-generated API client\n`;
    code += `// Base path: ${basePath}\n\n`;
    code += `const API_BASE = '${basePath}';\n\n`;

    endpoints.forEach(endpoint => {
      const functionName = this.endpointToFunctionName(endpoint);
      const params = endpoint.params || [];
      const queryParams = endpoint.queryParams || [];
      
      code += `export async function ${functionName}(`;
      
      if (params.length > 0) {
        code += `params: { ${params.map(p => `${p}: string`).join(', ')} }, `;
      }
      
      if (queryParams.length > 0) {
        code += `query?: { ${queryParams.map(q => `${q}?: string`).join(', ')} }, `;
      }
      
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        code += `body?: any, `;
      }
      
      code = code.replace(/, $/, '');
      code += `) {\n`;
      
      let url = `\`\${API_BASE}${endpoint.path}\``;
      if (params.length > 0) {
        params.forEach(p => {
          url = url.replace(`:${p}`, `\${params.${p}}`);
        });
      }
      
      code += `  const url = ${url};\n`;
      
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
  normalizePath(path) {
    return '/' + path.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
  }

  buildFullPath(path) {
    if (path.startsWith('/api')) {
      return path;
    }
    return `/api/v1${path}`;
  }

  updateBasePaths(fullPath) {
    const match = fullPath.match(/^(\/api\/v\d+)/);
    if (match && !this.registry.basePaths.includes(match[1])) {
      this.registry.basePaths.push(match[1]);
      this.registry.basePaths.sort();
    }
  }

  endpointToFunctionName(endpoint) {
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

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  pathSimilarity(path1, path2) {
    const segments1 = path1.split('/').filter(s => s);
    const segments2 = path2.split('/').filter(s => s);
    
    const common = segments1.filter(s => segments2.includes(s)).length;
    const total = Math.max(segments1.length, segments2.length);
    
    return total > 0 ? common / total : 0;
  }

  loadRegistry() {
    try {
      if (fs.existsSync(this.registryPath)) {
        const data = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
        return data;
      }
    } catch {}

    return {
      endpoints: [],
      basePaths: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  saveRegistry() {
    try {
      const dir = path.dirname(this.registryPath);
      fs.mkdirSync(dir, { recursive: true });
      this.registry.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 2));
    } catch (error) {
      console.error('Failed to save API registry:', error);
    }
  }

  generateId() {
    return `endpoint-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }
}

module.exports = { apiEndpointTracker: new APIEndpointTracker() };

