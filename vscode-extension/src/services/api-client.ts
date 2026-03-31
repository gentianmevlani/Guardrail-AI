/**
 * API Client Service
 * 
 * Handles communication between VS Code extension and guardrail API backend
 * Provides authenticated requests to real API endpoints
 */

import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthConfig {
  apiKey?: string;
  token?: string;
  baseUrl: string;
}

export class ApiClient {
  private config: AuthConfig;
  private extensionContext: vscode.ExtensionContext;

  constructor(extensionContext: vscode.ExtensionContext) {
    this.extensionContext = extensionContext;
    this.config = {
      baseUrl: this.getApiBaseUrl()
    };
    void this.loadAuthConfig();
  }

  /** Uses `guardrail.apiEndpoint` when set (see package.json contributes); otherwise production API. */
  private getApiBaseUrl(): string {
    const configured = vscode.workspace
      .getConfiguration('guardrail')
      .get<string>('apiEndpoint');
    if (configured && configured.trim().length > 0) {
      return configured.replace(/\/$/, '');
    }
    return 'https://api.guardrailai.dev';
  }

  async ensureAuthLoaded(): Promise<void> {
    this.config.baseUrl = this.getApiBaseUrl();
    await this.loadAuthConfig();
  }

  private async loadAuthConfig(): Promise<void> {
    const secretStorage = this.extensionContext.secrets;
    
    try {
      const apiKey = await secretStorage.get('guardrail.apiKey');
      const token = await secretStorage.get('guardrail.token');
      
      if (apiKey) {
        this.config.apiKey = apiKey;
      }
      if (token) {
        this.config.token = token;
      }
    } catch (error) {
      console.warn('Failed to load auth config:', error);
    }
  }

  async setApiKey(apiKey: string): Promise<void> {
    const secretStorage = this.extensionContext.secrets;
    await secretStorage.store('guardrail.apiKey', apiKey);
    this.config.apiKey = apiKey;
  }

  async setToken(token: string): Promise<void> {
    const secretStorage = this.extensionContext.secrets;
    await secretStorage.store('guardrail.token', token);
    this.config.token = token;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'guardrail-vscode-extension/1.0.0'
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    } else if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {} } = options;
    this.config.baseUrl = this.getApiBaseUrl();

    const url = new URL(endpoint, this.config.baseUrl);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const postData = body ? JSON.stringify(body) : undefined;
      
      const requestOptions: https.RequestOptions | http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          ...this.getAuthHeaders(),
          ...headers,
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
        },
        timeout: 30000
      };

      const req = httpModule.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              resolve({
                success: false,
                error: response.error || `HTTP ${res.statusCode}`,
                message: response.message
              });
            }
          } catch (error) {
            resolve({
              success: false,
              error: 'Invalid JSON response',
              message: data
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          message: 'Network error occurred'
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout',
          message: 'Request timed out after 30 seconds'
        });
      });

      if (postData) {
        req.write(postData);
      }
      
      req.end();
    });
  }

  /**
   * `makeRequest` resolves with raw JSON on 2xx; typed `ApiResponse` uses `data` for payloads.
   * Normalize to a single payload object for callers that expect fields on the body.
   */
  private unwrapSuccessBody<T extends Record<string, unknown>>(
    res: ApiResponse<T>,
  ): T | undefined {
    if (res.data !== undefined && res.data !== null && typeof res.data === 'object') {
      return res.data as T;
    }
    const plain = res as unknown as Record<string, unknown>;
    const { success: _s, error: _e, message: _m, data: _d, ...rest } = plain;
    if (Object.keys(rest).length === 0) {
      return undefined;
    }
    return rest as unknown as T;
  }

  // Compliance Dashboard API
  async getComplianceStatus(projectId: string): Promise<ApiResponse> {
    return this.makeRequest('/api/compliance/status', {
      method: 'POST',
      body: { projectId }
    });
  }

  async runComplianceAssessment(projectId: string, frameworkId: string): Promise<ApiResponse> {
    return this.makeRequest('/api/compliance/assess', {
      method: 'POST',
      body: { projectId, frameworkId }
    });
  }

  async getComplianceFrameworks(): Promise<ApiResponse> {
    return this.makeRequest('/api/compliance/frameworks');
  }

  async generateComplianceReport(projectId: string, format: 'json' | 'csv' | 'pdf'): Promise<ApiResponse> {
    return this.makeRequest(`/api/compliance/report?format=${format}`, {
      method: 'POST',
      body: { projectId }
    });
  }

  // Security Scanner API
  async runSecurityScan(projectPath: string, environment?: string): Promise<ApiResponse> {
    return this.makeRequest('/api/security/scan', {
      method: 'POST',
      body: { projectPath, environment }
    });
  }

  async getSecurityFindings(projectId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/security/findings/${projectId}`);
  }

  async runSecretScan(projectPath: string): Promise<ApiResponse> {
    return this.makeRequest('/api/security/secrets/scan', {
      method: 'POST',
      body: { projectPath }
    });
  }

  async getSecurityPolicies(): Promise<ApiResponse> {
    return this.makeRequest('/api/security/policies');
  }

  // Performance Monitor API
  async getPerformanceMetrics(projectId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/performance/metrics/${projectId}`);
  }

  async getPerformanceHistory(projectId: string, timeRange: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/performance/history/${projectId}?range=${timeRange}`);
  }

  async getPerformanceSuggestions(projectId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/performance/suggestions/${projectId}`);
  }

  // Change Impact Analyzer API
  async analyzeChangeImpact(changes: string[], projectId: string): Promise<ApiResponse> {
    return this.makeRequest('/api/impact/analyze', {
      method: 'POST',
      body: { changes, projectId }
    });
  }

  async getDependencyGraph(projectId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/impact/dependencies/${projectId}`);
  }

  async getBreakingChanges(projectId: string, version: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/impact/breaking-changes/${projectId}?version=${version}`);
  }

  // AI Code Explainer API
  async explainCode(code: string, language: string, detailLevel: string): Promise<ApiResponse> {
    return this.makeRequest('/api/ai/explain', {
      method: 'POST',
      body: { code, language, detailLevel }
    });
  }

  async generateDocumentation(code: string, language: string): Promise<ApiResponse> {
    return this.makeRequest('/api/ai/docs', {
      method: 'POST',
      body: { code, language }
    });
  }

  async getCodePatterns(code: string): Promise<ApiResponse> {
    return this.makeRequest('/api/ai/patterns', {
      method: 'POST',
      body: { code }
    });
  }

  // Team Collaboration API
  async getTeamMembers(organizationId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/team/members/${organizationId}`);
  }

  async getCodeReviews(projectId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/collaboration/reviews/${projectId}`);
  }

  async createCodeReview(reviewData: any): Promise<ApiResponse> {
    return this.makeRequest('/api/collaboration/reviews', {
      method: 'POST',
      body: reviewData
    });
  }

  async getKnowledgeShares(organizationId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/collaboration/knowledge/${organizationId}`);
  }

  async createKnowledgeShare(knowledgeData: any): Promise<ApiResponse> {
    return this.makeRequest('/api/collaboration/knowledge', {
      method: 'POST',
      body: knowledgeData
    });
  }

  async getTeamActivity(organizationId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/collaboration/activity/${organizationId}`);
  }

  // Production Integrity API
  async getProductionIntegrity(projectId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/production/integrity/${projectId}`);
  }

  async getProductionServices(projectId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/production/services/${projectId}`);
  }

  async getProductionIncidents(projectId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/production/incidents/${projectId}`);
  }

  async deployToProduction(deploymentData: any): Promise<ApiResponse> {
    return this.makeRequest('/api/production/deploy', {
      method: 'POST',
      body: deploymentData
    });
  }

  async rollbackDeployment(deploymentId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/production/rollback/${deploymentId}`, {
      method: 'POST'
    });
  }

  async runProductionHealthCheck(serviceId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/production/health-check/${serviceId}`, {
      method: 'POST'
    });
  }

  // MDC Generator API
  async generateMDC(projectPath: string, options: any): Promise<ApiResponse> {
    return this.makeRequest('/api/mdc/generate', {
      method: 'POST',
      body: { projectPath, ...options }
    });
  }

  async verifyMDCSources(mdcContent: string): Promise<ApiResponse> {
    return this.makeRequest('/api/mdc/verify', {
      method: 'POST',
      body: { content: mdcContent }
    });
  }

  async detectHallucinations(content: string): Promise<ApiResponse> {
    return this.makeRequest('/api/mdc/hallucination-detect', {
      method: 'POST',
      body: { content }
    });
  }

  // Dashboard API
  async getDashboardSummary(projectId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/dashboard/summary/${projectId}`);
  }

  async getRecentActivity(projectId: string): Promise<ApiResponse> {
    return this.makeRequest(`/api/dashboard/activity/${projectId}`);
  }

  async getHealthStatus(): Promise<ApiResponse> {
    return this.makeRequest('/api/health');
  }

  /** Upload a completed run so the web dashboard can show findings (uses X-API-Key or Bearer token). */
  async saveRunToCloud(body: {
    repo: string;
    branch?: string;
    commitSha?: string;
    verdict: string;
    score: number;
    securityResult?: unknown;
    realityResult?: unknown;
    guardrailResult?: unknown;
    traceUrl?: string;
    videoUrl?: string;
    source?: 'vscode';
    findings?: unknown[];
  }): Promise<ApiResponse> {
    await this.ensureAuthLoaded();
    return this.makeRequest('/api/runs/save', {
      method: 'POST',
      body,
    });
  }

  // Authentication API
  async authenticate(credentials: { email: string; password: string }): Promise<ApiResponse> {
    return this.makeRequest('/api/auth/login', {
      method: 'POST',
      body: credentials
    });
  }

  async refreshToken(): Promise<ApiResponse> {
    return this.makeRequest('/api/auth/refresh', {
      method: 'POST'
    });
  }

  async getUserProfile(): Promise<ApiResponse> {
    return this.makeRequest('/api/auth/profile');
  }

  // ── Device Code Flow ──

  /** Step 1: Request a device code pair from the API */
  async requestDeviceCode(): Promise<ApiResponse<{
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  }>> {
    return this.makeRequest('/api/auth/device', {
      method: 'POST',
      body: { client_type: 'vscode' }
    });
  }

  /** Step 2: Poll for authorization status */
  async pollDeviceCode(deviceCode: string): Promise<ApiResponse<{
    status: 'pending' | 'authorized' | 'expired';
    access_token?: string;
    user?: { id: string; email: string; name: string };
    plan?: string;
    scopes?: string[];
  }>> {
    return this.makeRequest('/api/auth/device/poll', {
      method: 'POST',
      body: { device_code: deviceCode }
    });
  }

  /**
   * Run the full device code login flow.
   * Opens browser, polls for authorization, stores token on success.
   * Returns the user info or throws on failure/timeout.
   */
  async deviceCodeLogin(
    onCode: (userCode: string, verificationUrl: string) => void,
    signal?: { cancelled: boolean },
  ): Promise<{ user: { id: string; email: string; name: string }; plan: string }> {
    // Request device code (success path may return raw JSON or `{ data }` per `makeRequest`)
    const codeRes = await this.requestDeviceCode();
    const codePayload = this.unwrapSuccessBody<
      {
        device_code: string;
        user_code: string;
        verification_url: string;
        expires_in: number;
        interval: number;
      }
    >(codeRes);
    if (!codePayload?.device_code) {
      throw new Error(codeRes.error || codeRes.message || 'Failed to start device code flow');
    }

    const { device_code, user_code, verification_url, expires_in, interval } = codePayload;

    // Notify caller of the code (for display)
    onCode(user_code, verification_url);

    // Poll until authorized or expired
    const deadline = Date.now() + (expires_in || 600) * 1000;
    const pollInterval = (interval || 5) * 1000;

    while (Date.now() < deadline) {
      if (signal?.cancelled) {
        throw new Error('Login cancelled');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const pollRes = await this.pollDeviceCode(device_code);
      const status = (pollRes as any).status;

      if (status === 'authorized') {
        const token = (pollRes as any).access_token;
        if (token) {
          await this.setApiKey(token);
        }
        return {
          user: (pollRes as any).user || { id: '', email: '', name: '' },
          plan: (pollRes as any).plan || 'free',
        };
      }

      if (status === 'expired') {
        throw new Error('Device code expired — please try again');
      }
    }

    throw new Error('Login timed out — please try again');
  }

  // Utility methods
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.getHealthStatus();
      return response.success;
    } catch (error) {
      return false;
    }
  }

  isAuthenticated(): boolean {
    return !!(this.config.apiKey || this.config.token);
  }

  getAuthEmail(): string | undefined {
    return undefined; // Will be populated from stored user info
  }

  async logout(): Promise<void> {
    const secretStorage = this.extensionContext.secrets;
    await secretStorage.delete('guardrail.apiKey');
    await secretStorage.delete('guardrail.token');
    await secretStorage.delete('guardrail.userInfo');
    this.config.apiKey = undefined;
    this.config.token = undefined;
  }

  /** Store user info after successful login */
  async setUserInfo(info: { id: string; email: string; name: string; plan: string }): Promise<void> {
    const secretStorage = this.extensionContext.secrets;
    await secretStorage.store('guardrail.userInfo', JSON.stringify(info));
  }

  /** Get stored user info */
  async getUserInfo(): Promise<{ id: string; email: string; name: string; plan: string } | null> {
    const secretStorage = this.extensionContext.secrets;
    try {
      const raw = await secretStorage.get('guardrail.userInfo');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
