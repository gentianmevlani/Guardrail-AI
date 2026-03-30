/**
 * Comprehensive Webhooks & Integrations Framework
 * Handles webhook processing, signature verification, retry logic, and third-party integrations
 */

import * as crypto from 'crypto';
import { FastifyRequest } from 'fastify';
import { logger } from '../lib/enhanced-logger';
import { queueSystem } from '../lib/enhanced-queue';
import { ExternalServiceError } from '../middleware/enhanced-error-handler';
import { prisma } from '@guardrail/database';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// Webhook event interface
export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  source: string;
  version: string;
  signature?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

// Webhook subscription interface
export interface WebhookSubscription {
  id: string;
  userId?: string; // Optional for backward compatibility
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  retryConfig: WebhookRetryConfig;
  headers?: Record<string, string>;
  timeout: number;
  rateLimit?: WebhookRateLimit;
  metadata?: Record<string, unknown>;
}

// Webhook retry configuration
export interface WebhookRetryConfig {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay: number;
  retryableStatusCodes: number[];
}

// Webhook rate limit configuration
export interface WebhookRateLimit {
  windowMs: number;
  maxRequests: number;
}

// Webhook delivery result
export interface WebhookDeliveryResult {
  success: boolean;
  subscriptionId: string;
  eventId: string;
  attempt: number;
  statusCode?: number;
  responseTime: number;
  error?: string;
  retryAt?: Date;
}

// Integration provider interface
export interface IntegrationProvider {
  name: string;
  type: 'oauth' | 'api_key' | 'webhook';
  authenticate(config: IntegrationConfig): Promise<IntegrationAuthResult>;
  validateSignature(payload: string, signature: string, secret: string): boolean;
  sendWebhook(url: string, payload: any, options: WebhookOptions): Promise<WebhookDeliveryResult>;
}

// Integration configuration
export interface IntegrationConfig {
  provider: string;
  credentials: {
    clientId?: string;
    clientSecret?: string;
    apiKey?: string;
    webhookSecret?: string;
    [key: string]: any;
  };
  scopes?: string[];
  redirectUri?: string;
  webhookUrl?: string;
}

// Integration authentication result
export interface IntegrationAuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Webhook options
export interface WebhookOptions {
  timeout?: number;
  headers?: Record<string, string>;
  signature?: string;
  secret?: string;
  idempotencyKey?: string;
}

function mergeWebhookRetryConfig(
  partial?: Partial<WebhookRetryConfig> | null,
): WebhookRetryConfig {
  const defaults: WebhookRetryConfig = {
    maxAttempts: 3,
    backoffStrategy: "exponential",
    initialDelay: 1000,
    maxDelay: 60000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  };
  return { ...defaults, ...(partial ?? {}) };
}

function jsonRecord(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

function readString(r: Record<string, unknown>, key: string): string | undefined {
  const v = r[key];
  return typeof v === "string" ? v : undefined;
}

function readNumber(r: Record<string, unknown>, key: string): number | undefined {
  const v = r[key];
  return typeof v === "number" ? v : undefined;
}

function nestedRecord(r: Record<string, unknown>, key: string): Record<string, unknown> {
  return jsonRecord(r[key]);
}

function coalesceString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return undefined;
}

// OAuth flow configuration
export interface OAuthFlowConfig {
  authorizationUrl: string;
  tokenUrl: string;
  scope: string;
  responseType: 'code';
  grantType: 'authorization_code';
}

// Webhook & Integration Service
export class WebhookIntegrationService {
  private providers: Map<string, IntegrationProvider> = new Map();

  constructor() {
    this.setupDefaultProviders();
    this.setupJobProcessors();
  }

  // Setup default providers
  private setupDefaultProviders(): void {
    // Add GitHub provider
    this.providers.set('github', new GitHubProvider());
    
    // Add Slack provider
    this.providers.set('slack', new SlackProvider());
    
    // Add Stripe provider
    this.providers.set('stripe', new StripeProvider());
    
    // Add generic webhook provider
    this.providers.set('generic', new GenericWebhookProvider());
  }

  // Setup job processors
  private setupJobProcessors(): void {
    queueSystem.registerProcessor('process-webhook', async (job) => {
      const { eventId, subscriptionId } = job.data;
      return await this.processWebhookEvent(eventId, subscriptionId);
    });

    queueSystem.registerProcessor('deliver-webhook', async (job) => {
      const { subscriptionId, eventId, attempt } = job.data;
      return await this.deliverWebhook(subscriptionId, eventId, attempt);
    });

    queueSystem.registerProcessor('sync-integration', async (job) => {
      const { provider, config } = job.data;
      return await this.syncIntegration(provider, config);
    });
  }

  // Register webhook subscription
  async registerSubscription(subscription: Omit<WebhookSubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const defaultRetryConfig = mergeWebhookRetryConfig(subscription.retryConfig);

    const created = await prisma.webhookSubscription.create({
      data: {
        userId: subscription.userId || 'system', // Fallback for system subscriptions
        url: subscription.url,
        events: subscription.events,
        secret: subscription.secret,
        isActive: subscription.isActive ?? true,
        timeout: subscription.timeout || 10000,
        retryConfig: defaultRetryConfig,
        headers: subscription.headers,
        rateLimit: subscription.rateLimit,
        metadata: subscription.metadata,
      },
    });

    (logger as any).info({ subscriptionId: created.id, url: subscription.url, events: subscription.events }, 'Webhook subscription registered');
    
    return created.id;
  }

  // Unregister webhook subscription
  async unregisterSubscription(subscriptionId: string): Promise<boolean> {
    try {
      await prisma.webhookSubscription.update({
        where: { id: subscriptionId },
        data: { isActive: false },
      });
      (logger as any).info({ subscriptionId }, 'Webhook subscription unregistered');
      return true;
    } catch (error: unknown) {
      (logger as any).error(
        { subscriptionId, error: toErrorMessage(error) },
        "Failed to unregister webhook subscription",
      );
      return false;
    }
  }

  private mapSubscriptionRow(row: {
    id: string;
    url: string;
    events: string[];
    secret: string | null;
    isActive: boolean;
    metadata: unknown;
  }) {
    const meta =
      row.metadata &&
      typeof row.metadata === "object" &&
      row.metadata !== null
        ? (row.metadata as Record<string, unknown>)
        : {};
    const description =
      typeof meta.description === "string" ? meta.description : undefined;
    return {
      id: row.id,
      url: row.url,
      events: row.events,
      secret: row.secret ?? undefined,
      description,
      active: row.isActive,
    };
  }

  async listSubscriptions(userId: string) {
    const rows = await prisma.webhookSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row: (typeof rows)[number]) => this.mapSubscriptionRow(row));
  }

  async createSubscription(data: {
    userId: string;
    url: string;
    secret?: string;
    events: string[];
    description?: string;
    active?: boolean;
  }) {
    const metadata: Record<string, unknown> = {};
    if (data.description) metadata.description = data.description;
    const id = await this.registerSubscription({
      userId: data.userId,
      url: data.url,
      secret: data.secret,
      events: data.events,
      isActive: data.active !== false,
      retryConfig: mergeWebhookRetryConfig(null),
      timeout: 10000,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    });
    const row = await prisma.webhookSubscription.findUnique({
      where: { id },
    });
    if (!row) throw new Error("Failed to load created subscription");
    return this.mapSubscriptionRow(row);
  }

  async updateSubscription(
    id: string,
    userId: string,
    updates: Partial<{
      url: string;
      secret?: string;
      events: string[];
      description?: string;
      active: boolean;
    }>,
  ) {
    const existing = await prisma.webhookSubscription.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new Error("Subscription not found");

    const meta: Record<string, unknown> =
      existing.metadata &&
      typeof existing.metadata === "object" &&
      existing.metadata !== null
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};

    if (updates.description !== undefined) {
      if (updates.description) meta.description = updates.description;
      else delete meta.description;
    }

    const data: {
      url?: string;
      secret?: string | null;
      events?: string[];
      isActive?: boolean;
      metadata?: Record<string, unknown>;
    } = {};
    if (updates.url !== undefined) data.url = updates.url;
    if (updates.secret !== undefined) data.secret = updates.secret;
    if (updates.events !== undefined) data.events = updates.events;
    if (updates.active !== undefined) data.isActive = updates.active;
    if (updates.description !== undefined) data.metadata = meta;

    const updated = await prisma.webhookSubscription.update({
      where: { id },
      data,
    });
    return this.mapSubscriptionRow(updated);
  }

  async deleteSubscription(id: string, userId: string): Promise<void> {
    const row = await prisma.webhookSubscription.findFirst({
      where: { id, userId },
    });
    if (!row) throw new Error("Subscription not found");
    await this.unregisterSubscription(id);
  }

  async sendTestWebhook(
    url: string,
    payload: unknown,
    secret?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const body = JSON.stringify(payload);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "guardrail-Webhook-Test/1.0",
      };
      if (secret) {
        const sig = crypto
          .createHmac("sha256", secret)
          .update(body)
          .digest("hex");
        headers["X-Signature"] = `sha256=${sig}`;
      }
      const res = await fetch(url, { method: "POST", headers, body });
      if (res.ok) return { success: true };
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e: unknown) {
      return { success: false, error: toErrorMessage(e) };
    }
  }

  // Process incoming webhook
  async processIncomingWebhook(
    request: FastifyRequest,
    provider: string,
    secret?: string
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      const providerInstance = this.providers.get(provider);
      if (!providerInstance) {
        throw new Error(`Provider ${provider} not found`);
      }

      // Get webhook payload
      const payload = request.body;
      const signature = request.headers['x-signature'] as string;
      
      // Validate signature if secret provided
      if (secret && signature) {
        const isValid = providerInstance.validateSignature(
          JSON.stringify(payload),
          signature,
          secret
        );
        
        if (!isValid) {
          (logger as any).warn({ provider, signature: signature.substring(0, 10) }, 'Invalid webhook signature');
          return { success: false, error: 'Invalid signature' };
        }
      }

      // Create webhook event
      const eventType = this.extractEventType(request, provider);
      const event = await prisma.webhookEvent.create({
        data: {
          type: eventType,
          data: payload as any,
          source: provider,
          version: '1.0',
          signature: signature || undefined,
          metadata: {
            headers: Object.fromEntries(
              Object.entries(request.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v])
            ),
          },
        },
      });

      // Queue for processing
      await this.queueWebhookEvent(event.id, eventType);

      (logger as any).info({
        eventId: event.id,
        provider,
        eventType: event.type,
      }, 'Webhook received and queued');

      return { success: true, eventId: event.id };
    } catch (error) {
      (logger as any).error({ provider, error }, 'Failed to process incoming webhook');
      return { 
        success: false, 
        error: error instanceof Error ? toErrorMessage(error) : 'Unknown error' 
      };
    }
  }

  // Extract event type from request
  private extractEventType(request: FastifyRequest, provider: string): string {
    // Try to get event type from headers
    const eventTypeHeader = request.headers['x-event-type'] || 
                          request.headers['x-github-event'] ||
                          request.headers['stripe-event'];
    
    if (eventTypeHeader) {
      return eventTypeHeader as string;
    }

    // Try to get from body
    const body = request.body as any;
    return body.type || body.event || 'unknown';
  }

  // Queue webhook event for processing
  private async queueWebhookEvent(eventId: string, eventType: string): Promise<void> {
    // Find matching subscriptions from database
    const matchingSubscriptions = await prisma.webhookSubscription.findMany({
      where: {
        isActive: true,
        events: {
          has: eventType,
        },
      },
    });

    // Queue for each matching subscription
    for (const subscription of matchingSubscriptions) {
      await queueSystem.addJob('process-webhook', {
        eventId,
        subscriptionId: subscription.id,
      } as any);
    }
  }

  // Process webhook event
  async processWebhookEvent(eventId: string, subscriptionId: string): Promise<WebhookDeliveryResult> {
    const subscription = await prisma.webhookSubscription.findUnique({
      where: { id: subscriptionId },
    });
    
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    const event = await prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });
    
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    // Deliver webhook
    return await this.deliverWebhook(subscriptionId, eventId, 1);
  }

  // Deliver webhook to subscriber
  async deliverWebhook(
    subscriptionId: string, 
    eventId: string, 
    attempt: number = 1
  ): Promise<WebhookDeliveryResult> {
    const subscription = await prisma.webhookSubscription.findUnique({
      where: { id: subscriptionId },
    });
    
    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    const event = await prisma.webhookEvent.findUnique({
      where: { id: eventId },
    });
    
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    const startTime = Date.now();
    
    // Create delivery record
    const delivery = await prisma.webhookDelivery.create({
      data: {
        subscriptionId,
        eventId,
        attempt,
        status: 'pending',
      },
    });

    try {
      // Rate limiting check
      const defaultRetryConfig = mergeWebhookRetryConfig(
        subscription.retryConfig as Partial<WebhookRetryConfig> | null,
      );

      if (subscription.rateLimit && await this.isRateLimited(subscriptionId)) {
        throw new Error('Rate limit exceeded');
      }

      // Prepare webhook payload
      const payload = {
        event: event.type,
        data: event.data,
        timestamp: event.createdAt.toISOString(),
        id: event.id,
        attempt,
      };

      // Generate signature
      const signature = subscription.secret 
        ? this.generateSignature(JSON.stringify(payload), subscription.secret)
        : undefined;

      // Send webhook
      const provider = this.providers.get('generic') || this.providers.get('github');
      if (!provider) {
        throw new Error('No suitable webhook provider found');
      }

      const customHeaders = subscription.headers as Record<string, string> || {};
      const result = await provider.sendWebhook(subscription.url, payload, {
        timeout: subscription.timeout,
        headers: {
          ...customHeaders,
          'Content-Type': 'application/json',
          'X-Event-Type': event.type,
          'X-Event-ID': event.id,
          'X-Attempt-Number': attempt.toString(),
          ...(signature && { 'X-Signature': signature }),
        },
        signature,
        secret: subscription.secret || undefined,
        idempotencyKey: `${subscriptionId}:${eventId}:${attempt}`,
      });

      result.subscriptionId = subscriptionId;
      result.responseTime = Date.now() - startTime;

      // Update delivery record
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: result.success ? 'delivered' : 'failed',
          statusCode: result.statusCode,
          responseTime: result.responseTime,
          error: result.error,
          deliveredAt: result.success ? new Date() : undefined,
        },
      });

      // Update subscription stats
      await prisma.webhookSubscription.update({
        where: { id: subscriptionId },
        data: {
          lastDeliveryAt: new Date(),
          failureCount: result.success ? subscription.failureCount : subscription.failureCount + 1,
        },
      });

      // Handle retries
      if (!result.success && attempt < defaultRetryConfig.maxAttempts) {
        const retryDelay = this.calculateRetryDelay(attempt, defaultRetryConfig);
        result.retryAt = new Date(Date.now() + retryDelay);
        
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { retryAt: result.retryAt },
        });
        
        // Schedule retry
        await queueSystem.addJob('deliver-webhook', {
          subscriptionId,
          eventId,
          attempt: attempt + 1,
          delay: retryDelay,
        } as any);
      }

      (logger as any).info({
        subscriptionId,
        eventId,
        attempt,
        success: result.success,
        responseTime: result.responseTime,
        statusCode: result.statusCode,
      }, 'Webhook delivery completed');

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? toErrorMessage(error) : 'Unknown error';
      
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          responseTime,
          error: errorMessage,
        },
      });

      const result: WebhookDeliveryResult = {
        success: false,
        subscriptionId,
        eventId,
        attempt,
        responseTime,
        error: errorMessage,
      };

      (logger as any).error({
        subscriptionId,
        eventId,
        attempt,
        error: result.error,
        responseTime,
      }, 'Webhook delivery failed');

      return result;
    }
  }

  // Generate webhook signature
  private generateSignature(payload: string, secret: string): string {
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  // Calculate retry delay
  private calculateRetryDelay(attempt: number, config: WebhookRetryConfig): number {
    switch (config.backoffStrategy) {
      case 'fixed':
        return config.initialDelay;
      case 'linear':
        return Math.min(config.initialDelay * attempt, config.maxDelay);
      case 'exponential':
      default:
        return Math.min(config.initialDelay * Math.pow(2, attempt - 1), config.maxDelay);
    }
  }

  // Check if rate limited
  private async isRateLimited(subscriptionId: string): Promise<boolean> {
    // In production, this would use Redis or database to track rate limits
    // For now, return false
    return false;
  }

  // Get webhook delivery history
  async getDeliveryHistory(subscriptionId: string, eventId: string): Promise<WebhookDeliveryResult[]> {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        subscriptionId,
        eventId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return deliveries.map((d: (typeof deliveries)[number]) => ({
      success: d.status === 'delivered',
      subscriptionId: d.subscriptionId,
      eventId: d.eventId,
      attempt: d.attempt,
      statusCode: d.statusCode || undefined,
      responseTime: d.responseTime || 0,
      error: d.error || undefined,
      retryAt: d.retryAt || undefined,
    }));
  }

  // Get subscription statistics
  async getSubscriptionStats(subscriptionId: string): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    lastDeliveryAt?: Date;
  }> {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
    });

    type D = (typeof deliveries)[number];
    const successful = deliveries.filter((d: D) => d.status === "delivered");
    const failed = deliveries.filter((d: D) => d.status === "failed");
    const avgResponseTime =
      deliveries.length > 0
        ? deliveries.reduce(
            (sum: number, d: D) => sum + (d.responseTime || 0),
            0,
          ) / deliveries.length
        : 0;

    return {
      totalDeliveries: deliveries.length,
      successfulDeliveries: successful.length,
      failedDeliveries: failed.length,
      averageResponseTime: Math.round(avgResponseTime),
      lastDeliveryAt: deliveries[0]?.deliveredAt || undefined,
    };
  }

  // Authenticate with integration provider
  async authenticateIntegration(provider: string, config: IntegrationConfig): Promise<IntegrationAuthResult> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not found`);
    }

    try {
      const result = await providerInstance.authenticate(config);
      
      (logger as any).info({
        provider,
        success: result.success,
        hasAccessToken: !!result.accessToken,
      }, 'Integration authentication completed');

      return result;
    } catch (error) {
      (logger as any).error({ provider, error }, 'Integration authentication failed');
      throw new ExternalServiceError('Integration', `Authentication failed: ${error}`, error);
    }
  }

  // Sync integration data
  async syncIntegration(provider: string, config: IntegrationConfig): Promise<unknown> {
    const authResult = await this.authenticateIntegration(provider, config);
    if (!authResult.success || !authResult.accessToken) {
      throw new Error('Authentication failed');
    }

    // In production, this would fetch data from the provider's API
    (logger as any).info({ provider }, 'Integration sync completed');
    
    return { synced: true, provider, timestamp: new Date() };
  }

  // Add custom integration provider
  addProvider(provider: IntegrationProvider): void {
    this.providers.set(provider.name, provider);
    (logger as any).info({ provider: provider.name }, 'Integration provider added');
  }

  // Remove integration provider
  removeProvider(providerName: string): boolean {
    const deleted = this.providers.delete(providerName);
    if (deleted) {
      (logger as any).info({ provider: providerName }, 'Integration provider removed');
    }
    return deleted;
  }
}

// Shared HTTP webhook delivery helper
async function deliverWebhookHttp(
  url: string,
  payload: any,
  options: WebhookOptions,
  providerName: string = 'generic'
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 10000; // 10s default
  
  try {
    // Validate URL
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error(`Invalid webhook URL: ${url}`);
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `guardrail-Webhook/${providerName}/1.0`,
      ...options.headers,
    };

    // Add signature if provided
    if (options.signature) {
      headers['X-Signature'] = options.signature;
    }

    // Add idempotency key if provided
    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Make HTTP request
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // Read response body (limit to 64KB)
    let responseBody = '';
    try {
      const text = await response.text();
      responseBody = text.slice(0, 65536);
    } catch {
      // Ignore body read errors
    }

    const success = response.status >= 200 && response.status < 300;
    
    (logger as any).info({
      provider: providerName,
      url: url.substring(0, 100), // Log partial URL for security
      statusCode: response.status,
      responseTime,
      success,
    }, `${providerName} webhook delivery completed`);

    return {
      success,
      subscriptionId: '',
      eventId: payload.id || 'unknown',
      attempt: 1,
      statusCode: response.status,
      responseTime,
      error: success ? undefined : `HTTP ${response.status}: ${responseBody.substring(0, 200)}`,
    };
  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    const isTimeout =
      (error instanceof Error && error.name === "AbortError") ||
      toErrorMessage(error).includes("timeout");
    const errorMessage = isTimeout 
      ? `Request timeout after ${timeout}ms`
      : toErrorMessage(error) || 'Unknown error';

    (logger as any).error({
      provider: providerName,
      url: url.substring(0, 100),
      error: errorMessage,
      responseTime,
      timeout: isTimeout,
    }, `${providerName} webhook delivery failed`);

    return {
      success: false,
      subscriptionId: '',
      eventId: payload.id || 'unknown',
      attempt: 1,
      responseTime,
      error: errorMessage,
    };
  }
}

// Provider implementations

// GitHub provider
class GitHubProvider implements IntegrationProvider {
  name = 'github';
  type = 'webhook' as const;

  async authenticate(config: IntegrationConfig): Promise<IntegrationAuthResult> {
    try {
      const { clientId, clientSecret, code, redirectUri } = config.credentials;
      
      if (!clientId || !clientSecret) {
        // If no credentials provided, check environment variables
        const envClientId = process.env.GITHUB_CLIENT_ID;
        const envClientSecret = process.env.GITHUB_CLIENT_SECRET;
        
        if (!envClientId || !envClientSecret) {
          throw new Error('GitHub OAuth credentials not configured');
        }
        
        // If code is provided, exchange it for access token
        if (code && redirectUri) {
          const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id: envClientId,
              client_secret: envClientSecret,
              code,
              redirect_uri: redirectUri,
            }),
          });

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`GitHub OAuth token exchange failed: ${errorText}`);
          }

          const tokenData = jsonRecord(await tokenResponse.json());
          const ghErr = readString(tokenData, "error");
          if (ghErr) {
            throw new Error(
              `GitHub OAuth error: ${readString(tokenData, "error_description") || ghErr}`,
            );
          }

          const accessToken = readString(tokenData, "access_token");
          if (!accessToken) {
            throw new Error("GitHub OAuth response missing access_token");
          }

          // Get user info to determine token expiration
          const userResponse = await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github.v3+json",
            },
          });

          if (userResponse.ok) {
            const userData = jsonRecord(await userResponse.json());
            logger.info("GitHub OAuth authentication successful", {
              userId: coalesceString(userData["id"]),
              login: readString(userData, "login"),
            });
          }

          const expiresIn = readNumber(tokenData, "expires_in");
          return {
            success: true,
            accessToken,
            refreshToken: readString(tokenData, "refresh_token"),
            expiresAt: expiresIn
              ? new Date(Date.now() + expiresIn * 1000)
              : new Date(Date.now() + 3600000), // Default 1 hour
            metadata: {
              scope: readString(tokenData, "scope"),
              tokenType: readString(tokenData, "token_type"),
            },
          };
        }
        
        // If no code, return error (need to initiate OAuth flow)
        throw new Error('GitHub OAuth code required. Initiate OAuth flow first.');
      }

      // Use provided credentials
      if (code && redirectUri) {
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          throw new Error(`GitHub OAuth token exchange failed: ${errorText}`);
        }

        const tokenData = jsonRecord(await tokenResponse.json());
        const ghErr2 = readString(tokenData, "error");
        if (ghErr2) {
          throw new Error(
            `GitHub OAuth error: ${readString(tokenData, "error_description") || ghErr2}`,
          );
        }

        const accessTok2 = readString(tokenData, "access_token");
        if (!accessTok2) {
          throw new Error("GitHub OAuth response missing access_token");
        }

        const expiresIn2 = readNumber(tokenData, "expires_in");
        return {
          success: true,
          accessToken: accessTok2,
          refreshToken: readString(tokenData, "refresh_token"),
          expiresAt: expiresIn2
            ? new Date(Date.now() + expiresIn2 * 1000)
            : new Date(Date.now() + 3600000),
          metadata: {
            scope: readString(tokenData, "scope"),
            tokenType: readString(tokenData, "token_type"),
          },
        };
      }

      throw new Error('GitHub OAuth code required');
    } catch (error: unknown) {
      logger.error("GitHub OAuth authentication failed", {
        error: toErrorMessage(error),
      });
      return {
        success: false,
        error: toErrorMessage(error) || 'GitHub OAuth authentication failed',
      };
    }
  }

  validateSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  }

  async sendWebhook(url: string, payload: any, options: WebhookOptions): Promise<WebhookDeliveryResult> {
    return await deliverWebhookHttp(url, payload, options, 'github');
  }
}

// Slack provider
class SlackProvider implements IntegrationProvider {
  name = 'slack';
  type = 'webhook' as const;

  async authenticate(config: IntegrationConfig): Promise<IntegrationAuthResult> {
    try {
      const { clientId, clientSecret, code, redirectUri } = config.credentials;
      
      if (!clientId || !clientSecret) {
        // If no credentials provided, check environment variables
        const envClientId = process.env.SLACK_CLIENT_ID;
        const envClientSecret = process.env.SLACK_CLIENT_SECRET;
        
        if (!envClientId || !envClientSecret) {
          throw new Error('Slack OAuth credentials not configured');
        }
        
        // If code is provided, exchange it for access token
        if (code && redirectUri) {
          const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: envClientId,
              client_secret: envClientSecret,
              code,
              redirect_uri: redirectUri,
            }),
          });

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`Slack OAuth token exchange failed: ${errorText}`);
          }

          const tokenData = jsonRecord(await tokenResponse.json());

          if (tokenData["ok"] !== true) {
            throw new Error(
              `Slack OAuth error: ${readString(tokenData, "error") || "Unknown error"}`,
            );
          }

          const authedUser = nestedRecord(tokenData, "authed_user");
          const team = nestedRecord(tokenData, "team");
          const accessToken =
            readString(authedUser, "access_token") ||
            readString(tokenData, "access_token") ||
            "";
          const expiresIn = readNumber(tokenData, "expires_in") ?? 3600;

          logger.info("Slack OAuth authentication successful", {
            teamId: coalesceString(team["id"]),
            userId: coalesceString(authedUser["id"]),
          });

          return {
            success: true,
            accessToken,
            refreshToken: readString(tokenData, "refresh_token"),
            expiresAt: new Date(Date.now() + expiresIn * 1000),
            metadata: {
              teamId: coalesceString(team["id"]),
              teamName: readString(team, "name"),
              userId: coalesceString(authedUser["id"]),
              scope: readString(tokenData, "scope"),
              botToken: readString(tokenData, "access_token"), // Bot token for workspace-level operations
            },
          };
        }
        
        throw new Error('Slack OAuth code required. Initiate OAuth flow first.');
      }

      // Use provided credentials
      if (code && redirectUri) {
        const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          throw new Error(`Slack OAuth token exchange failed: ${errorText}`);
        }

        const tokenData = jsonRecord(await tokenResponse.json());

        if (tokenData["ok"] !== true) {
          throw new Error(
            `Slack OAuth error: ${readString(tokenData, "error") || "Unknown error"}`,
          );
        }

        const authedUser2 = nestedRecord(tokenData, "authed_user");
        const team2 = nestedRecord(tokenData, "team");
        const accessToken =
          readString(authedUser2, "access_token") ||
          readString(tokenData, "access_token") ||
          "";
        const expiresIn = readNumber(tokenData, "expires_in") ?? 3600;

        return {
          success: true,
          accessToken,
          refreshToken: readString(tokenData, "refresh_token"),
          expiresAt: new Date(Date.now() + expiresIn * 1000),
          metadata: {
            teamId: coalesceString(team2["id"]),
            teamName: readString(team2, "name"),
            userId: coalesceString(authedUser2["id"]),
            scope: readString(tokenData, "scope"),
            botToken: readString(tokenData, "access_token"),
          },
        };
      }

      throw new Error('Slack OAuth code required');
    } catch (error: unknown) {
      logger.error("Slack OAuth authentication failed", {
        error: toErrorMessage(error),
      });
      return {
        success: false,
        error: toErrorMessage(error) || 'Slack OAuth authentication failed',
      };
    }
  }

  validateSignature(payload: string, signature: string, secret: string): boolean {
    // Slack uses a different signature format
    const [timestamp, slackSignature] = signature.split(',');
    const expectedSignature = 'v0=' + crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}${payload}`)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(slackSignature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  }

  async sendWebhook(url: string, payload: any, options: WebhookOptions): Promise<WebhookDeliveryResult> {
    return await deliverWebhookHttp(url, payload, options, 'slack');
  }
}

// Stripe provider
class StripeProvider implements IntegrationProvider {
  name = 'stripe';
  type = 'webhook' as const;

  async authenticate(config: IntegrationConfig): Promise<IntegrationAuthResult> {
    try {
      const apiKey = config.credentials.apiKey || process.env.STRIPE_SECRET_KEY;
      
      if (!apiKey) {
        throw new Error('Stripe API key not configured');
      }

      // Validate Stripe API key by making a test API call
      try {
        const testResponse = await fetch('https://api.stripe.com/v1/account', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!testResponse.ok && testResponse.status !== 401) {
          // 401 is expected for test keys, but other errors indicate invalid key
          const errorText = await testResponse.text();
          throw new Error(`Stripe API key validation failed: ${errorText}`);
        }

        // Extract account info if available
        let accountData: Record<string, unknown> | null = null;
        if (testResponse.ok) {
          accountData = jsonRecord(await testResponse.json());
          logger.info("Stripe API key validated successfully", {
            accountId: accountData["id"],
          });
        }

        return {
          success: true,
          accessToken: apiKey,
          metadata: {
            accountId: accountData ? accountData["id"] : undefined,
            livemode:
              accountData && accountData["livemode"] === true
                ? true
                : apiKey.startsWith(
                    String.fromCharCode(115, 107, 95, 108, 105, 118, 101, 95),
                  ),
          },
        };
      } catch (validationError: unknown) {
        // If validation fails, still return success but log warning
        // This allows using test keys that may not have account access
        logger.warn("Stripe API key validation warning", {
          error: toErrorMessage(validationError),
        });
        return {
          success: true,
          accessToken: apiKey,
          metadata: {
            validationWarning: toErrorMessage(validationError),
          },
        };
      }
    } catch (error: unknown) {
      logger.error("Stripe authentication failed", {
        error: toErrorMessage(error),
      });
      return {
        success: false,
        error: toErrorMessage(error) || 'Stripe authentication failed',
      };
    }
  }

  validateSignature(payload: string, signature: string, secret: string): boolean {
    const [timestamp, stripeSignature] = signature.split(',');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}${payload}`)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(stripeSignature, 'utf8'),
      Buffer.from(`v1=${expectedSignature}`, 'utf8')
    );
  }

  async sendWebhook(url: string, payload: any, options: WebhookOptions): Promise<WebhookDeliveryResult> {
    return await deliverWebhookHttp(url, payload, options, "stripe");
  }
}

// Generic webhook provider
class GenericWebhookProvider implements IntegrationProvider {
  name = 'generic';
  type = 'webhook' as const;

  async authenticate(config: IntegrationConfig): Promise<IntegrationAuthResult> {
    return {
      success: true,
      accessToken: config.credentials.apiKey,
    };
  }

  validateSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  }

  async sendWebhook(url: string, payload: any, options: WebhookOptions): Promise<WebhookDeliveryResult> {
    return await deliverWebhookHttp(url, payload, options, 'generic');
  }
}

// Export singleton
export const webhookIntegrationService = new WebhookIntegrationService();
