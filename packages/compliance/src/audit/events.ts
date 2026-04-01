/**
 * Audit Trail Event Schema
 * 
 * Comprehensive audit logging for Compliance+ tier.
 * All events are hash-chained for tamper evidence.
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import { stripeAnyKeyPrefixRegex } from 'guardrail-security/secrets/stripe-placeholder-prefix';

// Surface types - where the action originated
export type AuditSurface = 'cli' | 'vscode' | 'mcp' | 'web' | 'api' | 'ci';

// Action categories
export type AuditActionCategory = 
  | 'scan'
  | 'ship'
  | 'reality'
  | 'autopilot'
  | 'fix'
  | 'gate'
  | 'auth'
  | 'config'
  | 'export'
  | 'ai'
  | 'tool'
  | 'system';

// Result types
export type AuditResult = 'success' | 'failure' | 'partial' | 'skipped' | 'error';

// Subscription tiers for audit access control
export type AuditTier = 'free' | 'starter' | 'pro' | 'compliance' | 'enterprise' | 'unlimited';

// Zod schemas for validation
export const AuditEventMetadataSchema = z.object({
  // Command/action specific data
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  flags: z.record(z.unknown()).optional(),
  
  // Results
  score: z.number().optional(),
  grade: z.string().optional(),
  issueCount: z.number().optional(),
  fixCount: z.number().optional(),
  
  // Context
  projectPath: z.string().optional(),
  gitBranch: z.string().optional(),
  gitCommit: z.string().optional(),
  
  // Performance
  durationMs: z.number().optional(),
  
  // Error info (if result is error)
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  
  // Custom metadata
  custom: z.record(z.unknown()).optional(),
}).passthrough();

export type AuditEventMetadata = z.infer<typeof AuditEventMetadataSchema>;

export const AuditEventSchema = z.object({
  // Core identity
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  
  // Actor information
  actor: z.object({
    id: z.string(),
    type: z.enum(['user', 'system', 'ci', 'api']),
    name: z.string().optional(),
    email: z.string().email().optional(),
    ip: z.string().optional(),
  }),
  
  // Event classification
  surface: z.enum(['cli', 'vscode', 'mcp', 'web', 'api', 'ci']),
  action: z.string(),
  category: z.enum(['scan', 'ship', 'reality', 'autopilot', 'fix', 'gate', 'auth', 'config', 'export', 'ai', 'tool', 'system']),
  
  // Target of the action
  target: z.object({
    type: z.string(),
    id: z.string().optional(),
    path: z.string().optional(),
    name: z.string().optional(),
  }),
  
  // Access control
  tier: z.enum(['free', 'starter', 'pro', 'compliance', 'enterprise', 'unlimited']),
  
  // Outcome
  result: z.enum(['success', 'failure', 'partial', 'skipped', 'error']),
  
  // Additional context (tier-gated)
  metadata: AuditEventMetadataSchema.optional(),
  
  // Hash chain for tamper evidence
  hash: z.string(),
  prevHash: z.string(),
  
  // Version for schema evolution
  version: z.literal(1),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

// Input type for creating events (before hash chain)
export interface AuditEventInput {
  actor: AuditEvent['actor'];
  surface: AuditSurface;
  action: string;
  category: AuditActionCategory;
  target: AuditEvent['target'];
  tier: AuditTier;
  result: AuditResult;
  metadata?: AuditEventMetadata;
}

// Redaction patterns for sensitive data
const REDACTION_PATTERNS = [
  // API keys
  /(?:api[_-]?key|apikey|token|secret|password|pwd|auth)[=:]\s*['"]?([a-zA-Z0-9_\-]{16,})['"]?/gi,
  // JWT tokens
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  // AWS keys
  /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,
  // Generic secrets (Stripe-like prefixes)
  stripeAnyKeyPrefixRegex(),
  // Email addresses (partial redaction)
  /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
];

/**
 * Redact sensitive information from a string
 */
export function redactSensitive(input: string): string {
  let result = input;
  
  for (const pattern of REDACTION_PATTERNS) {
    result = result.replace(pattern, (match, ...groups) => {
      // For email, keep domain
      if (match.includes('@')) {
        return `[REDACTED]@${groups[1]}`;
      }
      // For other patterns, show type hint
      const typeHint = match.slice(0, 4).toLowerCase();
      return `[REDACTED:${typeHint}...]`;
    });
  }
  
  return result;
}

/**
 * Redact metadata based on tier
 * - Compliance+: Full metadata
 * - Pro: Limited metadata (no prompt bodies)
 * - Free/Starter: Minimal (action + result only)
 */
export function redactMetadataForTier(
  metadata: AuditEventMetadata | undefined,
  tier: AuditTier
): AuditEventMetadata | undefined {
  if (!metadata) return undefined;
  
  // Compliance+ and Enterprise get full metadata (still redact secrets)
  if (tier === 'compliance' || tier === 'enterprise' || tier === 'unlimited') {
    return redactMetadataSecrets(metadata);
  }
  
  // Pro gets limited metadata
  if (tier === 'pro') {
    const limited: AuditEventMetadata = {
      command: metadata.command,
      score: metadata.score,
      grade: metadata.grade,
      issueCount: metadata.issueCount,
      fixCount: metadata.fixCount,
      durationMs: metadata.durationMs,
      errorCode: metadata.errorCode,
    };
    return redactMetadataSecrets(limited);
  }
  
  // Free/Starter get minimal
  return {
    score: metadata.score,
    grade: metadata.grade,
  };
}

/**
 * Recursively redact secrets from metadata
 */
function redactMetadataSecrets(metadata: AuditEventMetadata): AuditEventMetadata {
  const result: AuditEventMetadata = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    
    if (typeof value === 'string') {
      result[key] = redactSensitive(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => 
        typeof v === 'string' ? redactSensitive(v) : v
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactMetadataSecrets(value as AuditEventMetadata);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Compute SHA-256 hash of event for chain integrity
 */
export function computeEventHash(event: Omit<AuditEvent, 'hash'>): string {
  const payload = JSON.stringify({
    id: event.id,
    timestamp: event.timestamp,
    actor: event.actor,
    surface: event.surface,
    action: event.action,
    category: event.category,
    target: event.target,
    tier: event.tier,
    result: event.result,
    metadata: event.metadata,
    prevHash: event.prevHash,
    version: event.version,
  });
  
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Verify hash chain integrity
 */
export function verifyEventHash(event: AuditEvent): boolean {
  const { hash, ...eventWithoutHash } = event;
  const computedHash = computeEventHash(eventWithoutHash);
  return computedHash === hash;
}

/**
 * Create a new audit event with proper hash chaining
 */
export function createAuditEvent(
  input: AuditEventInput,
  prevHash: string = '0'.repeat(64) // Genesis hash
): AuditEvent {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Redact metadata based on tier
  const redactedMetadata = redactMetadataForTier(input.metadata, input.tier);
  
  const eventWithoutHash: Omit<AuditEvent, 'hash'> = {
    id,
    timestamp,
    actor: input.actor,
    surface: input.surface,
    action: input.action,
    category: input.category,
    target: input.target,
    tier: input.tier,
    result: input.result,
    metadata: redactedMetadata,
    prevHash,
    version: 1,
  };
  
  const hash = computeEventHash(eventWithoutHash);
  
  return {
    ...eventWithoutHash,
    hash,
  };
}

// Pre-defined action types for consistency
export const AuditActions = {
  // Scan actions
  SCAN_START: 'scan.start',
  SCAN_COMPLETE: 'scan.complete',
  SCAN_ERROR: 'scan.error',
  
  // Ship actions
  SHIP_CHECK: 'ship.check',
  SHIP_APPROVE: 'ship.approve',
  SHIP_REJECT: 'ship.reject',
  
  // Reality actions
  REALITY_START: 'reality.start',
  REALITY_COMPLETE: 'reality.complete',
  REALITY_ERROR: 'reality.error',
  
  // Autopilot actions
  AUTOPILOT_ENABLE: 'autopilot.enable',
  AUTOPILOT_DISABLE: 'autopilot.disable',
  AUTOPILOT_RUN: 'autopilot.run',
  AUTOPILOT_REPORT: 'autopilot.report',
  
  // Fix actions
  FIX_PLAN: 'fix.plan',
  FIX_APPLY: 'fix.apply',
  FIX_REVERT: 'fix.revert',
  
  // Gate actions
  GATE_CHECK: 'gate.check',
  GATE_PASS: 'gate.pass',
  GATE_FAIL: 'gate.fail',
  
  // Auth actions
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_TOKEN_REFRESH: 'auth.token_refresh',
  
  // Config actions
  CONFIG_UPDATE: 'config.update',
  CONFIG_RESET: 'config.reset',
  
  // Export actions
  EXPORT_REPORT: 'export.report',
  EXPORT_AUDIT: 'export.audit',
  
  // AI actions
  AI_VALIDATE: 'ai.validate',
  AI_SUGGEST: 'ai.suggest',
  AI_CHECKPOINT: 'ai.checkpoint',
  
  // MCP Tool actions
  TOOL_INVOKE: 'tool.invoke',
  TOOL_COMPLETE: 'tool.complete',
  TOOL_ERROR: 'tool.error',
  
  // System actions
  SYSTEM_INIT: 'system.init',
  SYSTEM_UPGRADE: 'system.upgrade',
  SYSTEM_ERROR: 'system.error',
} as const;

export type AuditActionType = typeof AuditActions[keyof typeof AuditActions];
