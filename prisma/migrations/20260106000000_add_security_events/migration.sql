-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM (
  'login_success',
  'login_failure',
  'logout',
  'jwt_invalid',
  'jwt_expired',
  'password_reset_request',
  'password_reset_success',
  'password_reset_failure',
  'api_key_validated',
  'api_key_invalid',
  'api_key_policy_violation',
  'api_key_rate_limit_exceeded',
  'api_key_ip_restricted',
  'api_key_time_restricted',
  'role_granted',
  'role_revoked',
  'permission_granted',
  'permission_revoked',
  'access_denied',
  'privilege_escalation_attempt',
  'billing_webhook_received',
  'billing_webhook_verified',
  'billing_webhook_verification_failed',
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'payment_success',
  'payment_failure',
  'rate_limit_exceeded',
  'rate_limit_fallback_active',
  'ddos_detected',
  'suspicious_activity',
  'data_export',
  'data_import',
  'sensitive_data_accessed',
  'pii_accessed',
  'audit_log_accessed',
  'admin_action',
  'system_config_change',
  'security_policy_violation',
  'malicious_request_blocked',
  'upload_blocked',
  'resource_exhaustion_detected'
);

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateTable
CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL,
  "eventType" "SecurityEventType" NOT NULL,
  "payload" JSONB NOT NULL,
  "userId" TEXT,
  "orgId" TEXT,
  "severity" "Severity" NOT NULL DEFAULT 'medium',
  "requestId" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "route" TEXT,
  "method" TEXT,
  "apiKeyPrefix" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_timestamp_idx" ON "SecurityEvent"("userId", "timestamp");

-- CreateIndex
CREATE "SecurityEvent_eventType_timestamp_idx" ON "SecurityEvent"("eventType", "timestamp");

-- CreateIndex
CREATE "SecurityEvent_orgId_timestamp_idx" ON "SecurityEvent"("orgId", "timestamp");

-- CreateIndex
CREATE "SecurityEvent_severity_timestamp_idx" ON "SecurityEvent"("severity", "timestamp");

-- CreateIndex
CREATE "SecurityEvent_ip_timestamp_idx" ON "SecurityEvent"("ip", "timestamp");
