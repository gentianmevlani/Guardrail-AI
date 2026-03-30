/**
 * Audit Trail Emitter
 * 
 * Central audit event emission with tier-gating.
 * Usage: audit.emit(eventInput) from CLI, MCP, VS Code, etc.
 */

import { 
  AuditEvent,
  AuditEventInput,
  AuditSurface,
  AuditActionCategory,
  AuditResult,
  AuditTier,
  AuditEventMetadata,
  createAuditEvent,
  AuditActions,
} from './events';
import { 
  AuditStorageAdapter, 
  createStorageAdapter,
} from './storage';

// Singleton storage instance
let storageInstance: AuditStorageAdapter | null = null;

// Configuration
interface AuditConfig {
  enabled: boolean;
  tier: AuditTier;
  basePath: string;
  storageType: 'local' | 'server';
  serverUrl?: string;
  serverApiKey?: string;
  actor?: {
    id: string;
    type: 'user' | 'system' | 'ci' | 'api';
    name?: string;
    email?: string;
  };
}

const defaultConfig: AuditConfig = {
  enabled: true,
  tier: 'free',
  basePath: process.cwd(),
  storageType: 'local',
};

let currentConfig: AuditConfig = { ...defaultConfig };

/**
 * Configure the audit system
 */
export function configureAudit(config: Partial<AuditConfig>): void {
  currentConfig = { ...currentConfig, ...config };
  
  // Reset storage instance if config changed
  storageInstance = null;
}

/**
 * Get or create storage instance
 */
function getStorage(): AuditStorageAdapter {
  if (!storageInstance) {
    storageInstance = createStorageAdapter({
      type: currentConfig.storageType,
      basePath: currentConfig.basePath,
      apiUrl: currentConfig.serverUrl,
      apiKey: currentConfig.serverApiKey,
    });
  }
  return storageInstance;
}

/**
 * Check if audit is enabled for the current tier
 */
function isAuditEnabled(): boolean {
  if (!currentConfig.enabled) return false;
  
  // Minimal logging for free/starter (just basic events, no full trail)
  // Full audit trail requires compliance+ tier
  return true; // Always log something, tier controls detail level
}

/**
 * Check if full audit trail is available (Compliance+ tier)
 */
export function hasFullAuditAccess(): boolean {
  return ['compliance', 'enterprise', 'unlimited'].includes(currentConfig.tier);
}

/**
 * Get current actor from config or environment
 */
function getCurrentActor(): AuditEvent['actor'] {
  if (currentConfig.actor) {
    return currentConfig.actor;
  }
  
  const env = process.env as Record<string, string | undefined>;
  
  // Try to detect from environment
  const userId = env['GUARDRAIL_USER_ID'] || env['USER'] || 'anonymous';
  const userName = env['GUARDRAIL_USER_NAME'] || env['USERNAME'];
  const userEmail = env['GUARDRAIL_USER_EMAIL'];
  
  // Detect CI environment
  if (env['CI'] || env['GITHUB_ACTIONS'] || env['GITLAB_CI']) {
    return {
      id: env['GITHUB_ACTOR'] || env['GITLAB_USER_LOGIN'] || 'ci-system',
      type: 'ci',
      name: env['GITHUB_ACTOR'] || env['GITLAB_USER_NAME'],
    };
  }
  
  return {
    id: userId,
    type: 'user',
    name: userName,
    email: userEmail,
  };
}

/**
 * Emit an audit event
 */
export async function emit(input: AuditEventInput): Promise<AuditEvent | null> {
  if (!isAuditEnabled()) {
    return null;
  }
  
  const storage = getStorage();
  const prevHash = await storage.getLastHash();
  
  // Override tier with current config tier (for proper redaction)
  const event = createAuditEvent({
    ...input,
    tier: currentConfig.tier,
  }, prevHash);
  
  await storage.append(event);
  
  return event;
}

/**
 * Helper to emit with common defaults
 */
export async function emitAction(
  surface: AuditSurface,
  action: string,
  category: AuditActionCategory,
  target: AuditEvent['target'],
  result: AuditResult,
  metadata?: AuditEventMetadata
): Promise<AuditEvent | null> {
  return emit({
    actor: getCurrentActor(),
    surface,
    action,
    category,
    target,
    tier: currentConfig.tier,
    result,
    metadata,
  });
}

// Convenience methods for common CLI actions

export async function emitScanStart(
  surface: AuditSurface,
  projectPath: string,
  args?: string[]
): Promise<AuditEvent | null> {
  return emitAction(
    surface,
    AuditActions.SCAN_START,
    'scan',
    { type: 'project', path: projectPath },
    'success',
    { command: 'scan', args, projectPath }
  );
}

export async function emitScanComplete(
  surface: AuditSurface,
  projectPath: string,
  result: AuditResult,
  metadata?: { score?: number; grade?: string; issueCount?: number; durationMs?: number }
): Promise<AuditEvent | null> {
  return emitAction(
    surface,
    AuditActions.SCAN_COMPLETE,
    'scan',
    { type: 'project', path: projectPath },
    result,
    { command: 'scan', projectPath, ...metadata }
  );
}

export async function emitShipCheck(
  surface: AuditSurface,
  projectPath: string,
  result: AuditResult,
  metadata?: { score?: number; grade?: string; canShip?: boolean }
): Promise<AuditEvent | null> {
  return emitAction(
    surface,
    AuditActions.SHIP_CHECK,
    'ship',
    { type: 'project', path: projectPath },
    result,
    { command: 'ship', projectPath, custom: metadata }
  );
}

export async function emitRealityStart(
  surface: AuditSurface,
  url: string,
  flows?: string[]
): Promise<AuditEvent | null> {
  return emitAction(
    surface,
    AuditActions.REALITY_START,
    'reality',
    { type: 'url', path: url },
    'success',
    { command: 'reality', custom: { url, flows } }
  );
}

export async function emitRealityComplete(
  surface: AuditSurface,
  url: string,
  result: AuditResult,
  metadata?: { durationMs?: number; testsPassed?: number; testsFailed?: number }
): Promise<AuditEvent | null> {
  return emitAction(
    surface,
    AuditActions.REALITY_COMPLETE,
    'reality',
    { type: 'url', path: url },
    result,
    { command: 'reality', ...metadata }
  );
}

export async function emitAutopilotAction(
  surface: AuditSurface,
  action: 'enable' | 'disable' | 'run' | 'report',
  projectPath: string,
  result: AuditResult,
  metadata?: AuditEventMetadata
): Promise<AuditEvent | null> {
  const actionMap = {
    enable: AuditActions.AUTOPILOT_ENABLE,
    disable: AuditActions.AUTOPILOT_DISABLE,
    run: AuditActions.AUTOPILOT_RUN,
    report: AuditActions.AUTOPILOT_REPORT,
  };
  
  return emitAction(
    surface,
    actionMap[action],
    'autopilot',
    { type: 'project', path: projectPath },
    result,
    { command: 'autopilot', projectPath, ...metadata }
  );
}

export async function emitFixPlan(
  surface: AuditSurface,
  projectPath: string,
  result: AuditResult,
  metadata?: { fixCount?: number; scope?: string }
): Promise<AuditEvent | null> {
  return emitAction(
    surface,
    AuditActions.FIX_PLAN,
    'fix',
    { type: 'project', path: projectPath },
    result,
    { command: 'fix', projectPath, ...metadata }
  );
}

export async function emitFixApply(
  surface: AuditSurface,
  projectPath: string,
  result: AuditResult,
  metadata?: { fixCount?: number; filesModified?: number }
): Promise<AuditEvent | null> {
  return emitAction(
    surface,
    AuditActions.FIX_APPLY,
    'fix',
    { type: 'project', path: projectPath },
    result,
    { command: 'fix', projectPath, ...metadata }
  );
}

export async function emitGateCheck(
  surface: AuditSurface,
  projectPath: string,
  passed: boolean,
  metadata?: { policy?: string; score?: number }
): Promise<AuditEvent | null> {
  return emitAction(
    surface,
    passed ? AuditActions.GATE_PASS : AuditActions.GATE_FAIL,
    'gate',
    { type: 'project', path: projectPath },
    passed ? 'success' : 'failure',
    { command: 'gate', projectPath, ...metadata }
  );
}

export async function emitToolInvoke(
  surface: AuditSurface,
  toolName: string,
  args: Record<string, unknown>,
  result: AuditResult,
  metadata?: AuditEventMetadata
): Promise<AuditEvent | null> {
  return emitAction(
    surface,
    AuditActions.TOOL_INVOKE,
    'tool',
    { type: 'tool', name: toolName },
    result,
    { command: toolName, custom: { args }, ...metadata }
  );
}

export async function emitAuth(
  surface: AuditSurface,
  action: 'login' | 'logout' | 'token_refresh',
  result: AuditResult,
  metadata?: { method?: string }
): Promise<AuditEvent | null> {
  const actionMap = {
    login: AuditActions.AUTH_LOGIN,
    logout: AuditActions.AUTH_LOGOUT,
    token_refresh: AuditActions.AUTH_TOKEN_REFRESH,
  };
  
  return emitAction(
    surface,
    actionMap[action],
    'auth',
    { type: 'auth' },
    result,
    metadata
  );
}

// Export the audit object for convenient usage
export const audit = {
  configure: configureAudit,
  emit,
  emitAction,
  emitScanStart,
  emitScanComplete,
  emitShipCheck,
  emitRealityStart,
  emitRealityComplete,
  emitAutopilotAction,
  emitFixPlan,
  emitFixApply,
  emitGateCheck,
  emitToolInvoke,
  emitAuth,
  hasFullAccess: hasFullAuditAccess,
  getStorage,
};

export default audit;
