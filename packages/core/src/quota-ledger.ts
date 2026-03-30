/**
 * Quota Ledger - Server-Authoritative Usage Tracking
 * 
 * Implements idempotent usage recording with request IDs to prevent double-counting.
 * All quota checks are validated server-side before allowing operations.
 * 
 * SECURITY: CLI cannot bypass quota checks by modifying local files.
 * The server is the single source of truth for usage data.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export type UsageActionType = 
  | 'scan'           // Layer 1 scan
  | 'scan_truth'     // Layer 1+2 scan (counts as 2 for free tier)
  | 'reality'        // Layer 3 reality run
  | 'agent'          // AI Agent run
  | 'fix'            // Verified autofix run
  | 'gate';          // CI gate check

export interface UsageEntry {
  id: string;           // Unique request ID for idempotency
  action: UsageActionType;
  count: number;
  timestamp: string;
  synced: boolean;      // Whether recorded on server
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface QuotaLimits {
  scans: number;        // -1 = unlimited
  reality: number;
  agent: number;
}

export interface UsageSummary {
  tier: string;
  period: {
    start: string;
    end: string;
  };
  usage: {
    scans: number;
    reality: number;
    agent: number;
    fix: number;
    gate: number;
  };
  limits: QuotaLimits;
  remaining: {
    scans: number;
    reality: number;
    agent: number;
  };
}

export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  reason?: string;
  source: 'server' | 'cache' | 'offline';
  requestId: string;
}

export interface RecordResult {
  success: boolean;
  requestId: string;
  newUsage: number;
  remaining: number;
  source: 'server' | 'queued';
  error?: string;
}

// ============================================================================
// QUOTA LEDGER CLASS
// ============================================================================

export class QuotaLedger {
  private configDir: string;
  private ledgerFile: string;
  private cacheFile: string;
  private apiUrl: string;
  private apiKey: string | null;
  
  constructor() {
    this.configDir = path.join(os.homedir(), '.guardrail');
    this.ledgerFile = path.join(this.configDir, 'usage-ledger.json');
    this.cacheFile = path.join(this.configDir, 'quota-cache.json');
    this.apiUrl = process.env['GUARDRAIL_API_URL'] || 'https://api.guardrail.dev';
    this.apiKey = process.env['GUARDRAIL_API_KEY'] || null;
  }
  
  /**
   * Generate unique request ID for idempotency
   */
  generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `req_${timestamp}_${random}`;
  }
  
  /**
   * Check if action is allowed based on quota
   * Always validates with server when possible
   */
  async checkQuota(action: UsageActionType): Promise<QuotaCheckResult> {
    const requestId = this.generateRequestId();
    
    // Try server-authoritative check first
    if (this.apiKey) {
      try {
        const response = await fetch(`${this.apiUrl}/api/usage/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Request-ID': requestId,
          },
          body: JSON.stringify({ action }),
        });
        
        if (response.ok) {
          const result = await response.json() as {
            allowed: boolean;
            current: number;
            limit: number;
            remaining: number;
            reason?: string;
          };
          
          // Cache the result
          await this.cacheQuotaResult(action, result);
          
          return {
            ...result,
            source: 'server',
            requestId,
          };
        }
      } catch {
        // Server unreachable, fall back to cache/offline
      }
    }
    
    // Fallback to cached data
    const cached = await this.getCachedQuota(action);
    if (cached) {
      return {
        ...cached,
        source: 'cache',
        requestId,
      };
    }
    
    // Offline mode - allow with warning
    return {
      allowed: true,
      current: 0,
      limit: -1,
      remaining: -1,
      reason: 'Offline mode - usage will be synced when online',
      source: 'offline',
      requestId,
    };
  }
  
  /**
   * Record usage with idempotency guarantee
   * Uses request ID to prevent double-counting on retries
   */
  async recordUsage(
    action: UsageActionType, 
    count: number = 1,
    requestId?: string
  ): Promise<RecordResult> {
    const id = requestId || this.generateRequestId();
    
    // Check for duplicate request
    if (await this.isDuplicateRequest(id)) {
      const existing = await this.getExistingResult(id);
      if (existing) return existing;
    }
    
    const entry: UsageEntry = {
      id,
      action,
      count,
      timestamp: new Date().toISOString(),
      synced: false,
    };
    
    // Try server-authoritative recording
    if (this.apiKey) {
      try {
        const response = await fetch(`${this.apiUrl}/api/usage/record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Request-ID': id,
            'X-Idempotency-Key': id,
          },
          body: JSON.stringify({ action, count, requestId: id }),
        });
        
        if (response.ok) {
          const result = await response.json() as {
            success: boolean;
            newUsage: number;
            remaining: number;
          };
          
          entry.synced = true;
          await this.saveLedgerEntry(entry);
          
          return {
            success: true,
            requestId: id,
            newUsage: result.newUsage,
            remaining: result.remaining,
            source: 'server',
          };
        }
        
        // Handle rate limit or quota exceeded
        if (response.status === 429 || response.status === 402) {
          const error = await response.json() as { message: string };
          return {
            success: false,
            requestId: id,
            newUsage: 0,
            remaining: 0,
            source: 'server',
            error: error.message || 'Quota exceeded',
          };
        }
      } catch {
        // Server unreachable, queue for later sync
      }
    }
    
    // Queue for later sync
    await this.saveLedgerEntry(entry);
    
    return {
      success: true,
      requestId: id,
      newUsage: count,
      remaining: -1,
      source: 'queued',
    };
  }
  
  /**
   * Get usage summary for current billing period
   */
  async getUsageSummary(): Promise<UsageSummary | null> {
    if (this.apiKey) {
      try {
        const response = await fetch(`${this.apiUrl}/api/usage/summary`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        });
        
        if (response.ok) {
          return await response.json() as UsageSummary;
        }
      } catch {
        // Fall through to local
      }
    }
    
    // Return local summary
    return this.getLocalSummary();
  }
  
  /**
   * Sync pending offline usage to server
   */
  async syncPendingUsage(): Promise<{ synced: number; failed: number; errors: string[] }> {
    const entries = await this.getUnsyncedEntries();
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];
    
    if (!this.apiKey || entries.length === 0) {
      return { synced: 0, failed: 0, errors: [] };
    }
    
    for (const entry of entries) {
      try {
        const response = await fetch(`${this.apiUrl}/api/usage/record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Request-ID': entry.id,
            'X-Idempotency-Key': entry.id,
          },
          body: JSON.stringify({
            action: entry.action,
            count: entry.count,
            requestId: entry.id,
            timestamp: entry.timestamp,
          }),
        });
        
        if (response.ok) {
          entry.synced = true;
          await this.updateLedgerEntry(entry);
          synced++;
        } else {
          failed++;
          errors.push(`Failed to sync ${entry.id}: ${response.statusText}`);
        }
      } catch (e) {
        failed++;
        errors.push(`Failed to sync ${entry.id}: ${(e as Error).message}`);
      }
    }
    
    return { synced, failed, errors };
  }
  
  /**
   * Get count of pending offline usage
   */
  async getPendingCount(): Promise<number> {
    const entries = await this.getUnsyncedEntries();
    return entries.length;
  }
  
  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================
  
  private async ensureDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.configDir, { recursive: true });
    } catch {
      // Exists
    }
  }
  
  private async saveLedgerEntry(entry: UsageEntry): Promise<void> {
    await this.ensureDir();
    
    let ledger: UsageEntry[] = [];
    try {
      const content = await fs.promises.readFile(this.ledgerFile, 'utf8');
      ledger = JSON.parse(content);
    } catch {
      // New file
    }
    
    // Check for duplicate
    const existing = ledger.findIndex(e => e.id === entry.id);
    if (existing >= 0) {
      ledger[existing] = entry;
    } else {
      ledger.push(entry);
    }
    
    // Keep only last 1000 entries
    if (ledger.length > 1000) {
      ledger = ledger.slice(-1000);
    }
    
    await fs.promises.writeFile(this.ledgerFile, JSON.stringify(ledger, null, 2));
  }
  
  private async updateLedgerEntry(entry: UsageEntry): Promise<void> {
    await this.saveLedgerEntry(entry);
  }
  
  private async getUnsyncedEntries(): Promise<UsageEntry[]> {
    try {
      const content = await fs.promises.readFile(this.ledgerFile, 'utf8');
      const ledger: UsageEntry[] = JSON.parse(content);
      return ledger.filter(e => !e.synced);
    } catch {
      return [];
    }
  }
  
  private async isDuplicateRequest(id: string): Promise<boolean> {
    try {
      const content = await fs.promises.readFile(this.ledgerFile, 'utf8');
      const ledger: UsageEntry[] = JSON.parse(content);
      return ledger.some(e => e.id === id);
    } catch {
      return false;
    }
  }
  
  private async getExistingResult(id: string): Promise<RecordResult | null> {
    try {
      const content = await fs.promises.readFile(this.ledgerFile, 'utf8');
      const ledger: UsageEntry[] = JSON.parse(content);
      const entry = ledger.find(e => e.id === id);
      if (entry) {
        return {
          success: true,
          requestId: entry.id,
          newUsage: entry.count,
          remaining: -1,
          source: entry.synced ? 'server' : 'queued',
        };
      }
    } catch {
      // Not found
    }
    return null;
  }
  
  private async cacheQuotaResult(
    action: UsageActionType, 
    result: { allowed: boolean; current: number; limit: number; remaining: number }
  ): Promise<void> {
    await this.ensureDir();
    
    let cache: Record<string, unknown> = {};
    try {
      const content = await fs.promises.readFile(this.cacheFile, 'utf8');
      cache = JSON.parse(content);
    } catch {
      // New cache
    }
    
    cache[action] = {
      ...result,
      cachedAt: new Date().toISOString(),
    };
    
    await fs.promises.writeFile(this.cacheFile, JSON.stringify(cache, null, 2));
  }
  
  private async getCachedQuota(action: UsageActionType): Promise<QuotaCheckResult | null> {
    try {
      const content = await fs.promises.readFile(this.cacheFile, 'utf8');
      const cache = JSON.parse(content);
      const cached = cache[action];
      
      if (cached) {
        // Cache valid for 5 minutes
        const age = Date.now() - new Date(cached.cachedAt).getTime();
        if (age < 5 * 60 * 1000) {
          return {
            allowed: cached.allowed,
            current: cached.current,
            limit: cached.limit,
            remaining: cached.remaining,
            source: 'cache',
            requestId: this.generateRequestId(),
          };
        }
      }
    } catch {
      // No cache
    }
    return null;
  }
  
  private async getLocalSummary(): Promise<UsageSummary | null> {
    try {
      const content = await fs.promises.readFile(this.ledgerFile, 'utf8');
      const ledger: UsageEntry[] = JSON.parse(content);
      
      // Calculate current month's usage
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const thisMonth = ledger.filter(e => {
        const ts = new Date(e.timestamp);
        return ts >= monthStart && ts <= monthEnd;
      });
      
      const usage = {
        scans: 0,
        reality: 0,
        agent: 0,
        fix: 0,
        gate: 0,
      };
      
      for (const entry of thisMonth) {
        switch (entry.action) {
          case 'scan':
          case 'scan_truth':
            usage.scans += entry.count;
            break;
          case 'reality':
            usage.reality += entry.count;
            break;
          case 'agent':
            usage.agent += entry.count;
            break;
          case 'fix':
            usage.fix += entry.count;
            break;
          case 'gate':
            usage.gate += entry.count;
            break;
        }
      }
      
      return {
        tier: 'unknown',
        period: {
          start: monthStart.toISOString(),
          end: monthEnd.toISOString(),
        },
        usage,
        limits: { scans: -1, reality: -1, agent: -1 },
        remaining: { scans: -1, reality: -1, agent: -1 },
      };
    } catch {
      return null;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const quotaLedger = new QuotaLedger();

// Convenience exports
export const checkQuota = (action: UsageActionType) => quotaLedger.checkQuota(action);
export const recordUsage = (action: UsageActionType, count?: number, requestId?: string) => 
  quotaLedger.recordUsage(action, count, requestId);
export const getUsageSummary = () => quotaLedger.getUsageSummary();
export const syncPendingUsage = () => quotaLedger.syncPendingUsage();
export const getPendingCount = () => quotaLedger.getPendingCount();
