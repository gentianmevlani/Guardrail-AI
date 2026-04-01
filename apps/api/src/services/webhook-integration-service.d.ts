/**
 * Comprehensive Webhooks & Integrations Framework
 * Handles webhook processing, signature verification, retry logic, and third-party integrations
 */
import { FastifyRequest } from 'fastify';
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
export interface WebhookSubscription {
    id: string;
    userId?: string;
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
export interface WebhookRetryConfig {
    maxAttempts: number;
    backoffStrategy: 'fixed' | 'exponential' | 'linear';
    initialDelay: number;
    maxDelay: number;
    retryableStatusCodes: number[];
}
export interface WebhookRateLimit {
    windowMs: number;
    maxRequests: number;
}
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
export interface IntegrationProvider {
    name: string;
    type: 'oauth' | 'api_key' | 'webhook';
    authenticate(config: IntegrationConfig): Promise<IntegrationAuthResult>;
    validateSignature(payload: string, signature: string, secret: string): boolean;
    sendWebhook(url: string, payload: any, options: WebhookOptions): Promise<WebhookDeliveryResult>;
}
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
export interface IntegrationAuthResult {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
    error?: string;
    metadata?: Record<string, unknown>;
}
export interface WebhookOptions {
    timeout?: number;
    headers?: Record<string, string>;
    signature?: string;
    secret?: string;
    idempotencyKey?: string;
}
export interface OAuthFlowConfig {
    authorizationUrl: string;
    tokenUrl: string;
    scope: string;
    responseType: 'code';
    grantType: 'authorization_code';
}
export declare class WebhookIntegrationService {
    private providers;
    constructor();
    private setupDefaultProviders;
    private setupJobProcessors;
    registerSubscription(subscription: Omit<WebhookSubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
    unregisterSubscription(subscriptionId: string): Promise<boolean>;
    processIncomingWebhook(request: FastifyRequest, provider: string, secret?: string): Promise<{
        success: boolean;
        eventId?: string;
        error?: string;
    }>;
    private extractEventType;
    private queueWebhookEvent;
    processWebhookEvent(eventId: string, subscriptionId: string): Promise<WebhookDeliveryResult>;
    deliverWebhook(subscriptionId: string, eventId: string, attempt?: number): Promise<WebhookDeliveryResult>;
    private generateSignature;
    private calculateRetryDelay;
    private isRateLimited;
    getDeliveryHistory(subscriptionId: string, eventId: string): Promise<WebhookDeliveryResult[]>;
    getSubscriptionStats(subscriptionId: string): Promise<{
        totalDeliveries: number;
        successfulDeliveries: number;
        failedDeliveries: number;
        averageResponseTime: number;
        lastDeliveryAt?: Date;
    }>;
    authenticateIntegration(provider: string, config: IntegrationConfig): Promise<IntegrationAuthResult>;
    syncIntegration(provider: string, config: IntegrationConfig): Promise<unknown>;
    addProvider(provider: IntegrationProvider): void;
    removeProvider(providerName: string): boolean;
}
export declare const webhookIntegrationService: WebhookIntegrationService;
//# sourceMappingURL=webhook-integration-service.d.ts.map