/**
 * Settings API - User preferences and settings
 */
import { apiGet, apiPost, apiPut, apiDelete, ApiResponse } from "./core";

export interface NotificationPreferences {
  emailNotifications: boolean;
  inAppNotifications: boolean;
  slackWebhook?: string;
  weeklyDigest: boolean;
  securityAlerts: boolean;
  scanComplete: boolean;
  teamInvites: boolean;
}

export interface ScanPreferences {
  scanDepth: "quick" | "standard" | "deep";
  autoScan: boolean;
  ignoredPaths: string;
  severityThreshold: "low" | "medium" | "high" | "critical";
  parallelScans: boolean;
  timeoutMinutes: number;
}

export interface AppearancePreferences {
  theme: "dark" | "light" | "system";
  compactMode: boolean;
  sidebarCollapsed: boolean;
  codeSyntaxHighlighting: boolean;
  animationsEnabled: boolean;
}

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await apiGet<NotificationPreferences>(
    "/api/settings/notifications",
    { requireAuth: true },
  );
  return response.data || {
    emailNotifications: true,
    inAppNotifications: true,
    weeklyDigest: true,
    securityAlerts: true,
    scanComplete: true,
    teamInvites: true,
  };
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const response = await apiPut<NotificationPreferences>(
    "/api/settings/notifications",
    preferences,
    { requireAuth: true },
  );
  return response.data!;
}

/**
 * Get scan preferences
 */
export async function getScanPreferences(): Promise<ScanPreferences> {
  const response = await apiGet<ScanPreferences>(
    "/api/settings/scan-preferences",
    { requireAuth: true },
  );
  return response.data || {
    scanDepth: "standard",
    autoScan: false,
    ignoredPaths: "*.log\nnode_modules/\n.env*\ncoverage/",
    severityThreshold: "medium",
    parallelScans: true,
    timeoutMinutes: 30,
  };
}

/**
 * Update scan preferences
 */
export async function updateScanPreferences(
  preferences: Partial<ScanPreferences>,
): Promise<ScanPreferences> {
  const response = await apiPut<ScanPreferences>(
    "/api/settings/scan-preferences",
    preferences,
    { requireAuth: true },
  );
  return response.data!;
}

/**
 * Get appearance preferences
 */
export async function getAppearancePreferences(): Promise<AppearancePreferences> {
  const response = await apiGet<AppearancePreferences>(
    "/api/settings/appearance",
    { requireAuth: true },
  );
  return response.data || {
    theme: "dark",
    compactMode: false,
    sidebarCollapsed: false,
    codeSyntaxHighlighting: true,
    animationsEnabled: true,
  };
}

/**
 * Update appearance preferences
 */
export async function updateAppearancePreferences(
  preferences: Partial<AppearancePreferences>,
): Promise<AppearancePreferences> {
  const response = await apiPut<AppearancePreferences>(
    "/api/settings/appearance",
    preferences,
    { requireAuth: true },
  );
  return response.data!;
}

// ===== Webhook Configuration =====

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  description?: string;
  createdAt?: string;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: "success" | "failed" | null;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  status: "success" | "failed" | "pending";
  statusCode?: number;
  responseTime?: number;
  error?: string;
  createdAt: string;
}

export interface WebhookTestResult {
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

/**
 * Get all webhook endpoints for the current user
 */
export async function getWebhookEndpoints(): Promise<WebhookEndpoint[]> {
  const response = await apiGet<WebhookEndpoint[]>(
    "/api/settings/webhooks",
    { requireAuth: true },
  );
  return response.data || [];
}

/**
 * Create a new webhook endpoint
 */
export async function createWebhookEndpoint(
  webhook: Omit<WebhookEndpoint, "id" | "createdAt" | "lastDeliveryAt" | "lastDeliveryStatus">,
): Promise<WebhookEndpoint> {
  const response = await apiPost<WebhookEndpoint>(
    "/api/settings/webhooks",
    webhook,
    { requireAuth: true },
  );
  return response.data!;
}

/**
 * Update an existing webhook endpoint
 */
export async function updateWebhookEndpoint(
  id: string,
  updates: Partial<WebhookEndpoint>,
): Promise<WebhookEndpoint> {
  const response = await apiPut<WebhookEndpoint>(
    `/api/settings/webhooks/${id}`,
    updates,
    { requireAuth: true },
  );
  return response.data!;
}

/**
 * Delete a webhook endpoint
 */
export async function deleteWebhookEndpoint(id: string): Promise<void> {
  await apiDelete(`/api/settings/webhooks/${id}`, { requireAuth: true });
}

/**
 * Test a webhook endpoint by sending a test payload
 */
export async function testWebhookEndpoint(id: string): Promise<WebhookTestResult> {
  const response = await apiPost<WebhookTestResult>(
    `/api/settings/webhooks/${id}/test`,
    {},
    { requireAuth: true },
  );
  return response.data!;
}

/**
 * Get delivery history for a webhook endpoint
 */
export async function getWebhookDeliveries(
  webhookId: string,
  limit: number = 10,
): Promise<WebhookDelivery[]> {
  const response = await apiGet<WebhookDelivery[]>(
    `/api/settings/webhooks/${webhookId}/deliveries?limit=${limit}`,
    { requireAuth: true },
  );
  return response.data || [];
}

// ===== MFA API =====

export interface MFAStatus {
  enabled: boolean;
  remainingBackupCodes: number;
  verifiedAt?: string;
}

export interface MFASetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

/**
 * Get MFA status for the current user
 */
export async function getMFAStatus(): Promise<MFAStatus> {
  const response = await apiGet<{ data: MFAStatus }>(
    "/api/mfa/status",
    { requireAuth: true },
  );
  return response.data?.data || { enabled: false, remainingBackupCodes: 0 };
}

/**
 * Start MFA setup - generates QR code and backup codes
 */
export async function setupMFA(): Promise<MFASetupResponse> {
  const response = await apiPost<{ data: MFASetupResponse }>(
    "/api/mfa/setup",
    {},
    { requireAuth: true },
  );
  return response.data!.data;
}

/**
 * Verify MFA setup with TOTP code
 */
export async function verifyMFASetup(token: string): Promise<boolean> {
  const response = await apiPost<{ success: boolean }>(
    "/api/mfa/verify-setup",
    { token },
    { requireAuth: true },
  );
  return response.data?.success || false;
}

/**
 * Disable MFA (requires password)
 */
export async function disableMFA(password: string): Promise<boolean> {
  const response = await apiPost<{ success: boolean }>(
    "/api/mfa/disable",
    { password },
    { requireAuth: true },
  );
  return response.data?.success || false;
}
