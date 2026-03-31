/**
 * Server-Authoritative Usage Enforcement (CLI Client)
 * 
 * This module handles server-side usage checks and enforcement.
 * Local ~/.guardrail/usage.json is ONLY a cache - never authoritative.
 * 
 * Flow:
 * 1. Check server for usage limits before any quota-limited action
 * 2. If online: server is source of truth
 * 3. If offline: allow 1 action max, require sync next time
 * 4. Cache signed tokens locally for optimization (short TTL)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG_DIR = path.join(os.homedir(), '.guardrail');
const CACHE_FILE = path.join(CONFIG_DIR, 'usage-cache.json');
const OFFLINE_FILE = path.join(CONFIG_DIR, 'offline-queue.json');

const API_BASE_URL = process.env.GUARDRAIL_API_URL || 'https://api.guardrailai.dev';
const USAGE_API_PATH = '/api/usage/v2';

const OFFLINE_ALLOWANCE = 1; // Max offline actions before sync required
const TOKEN_GRACE_PERIOD_MS = 30000; // 30 seconds grace period for token expiry

// ============================================================================
// HELPERS
// ============================================================================

async function ensureConfigDir() {
  try {
    await fs.promises.mkdir(CONFIG_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

function getAuthToken() {
  // Check environment variable first
  if (process.env.GUARDRAIL_API_KEY) {
    return process.env.GUARDRAIL_API_KEY;
  }
  
  // Check license file
  try {
    const licensePath = path.join(CONFIG_DIR, 'license.json');
    const license = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
    return license.apiKey || license.token;
  } catch {
    return null;
  }
}

function getMachineId() {
  // Generate a stable machine identifier
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();
  const hash = crypto.createHash('sha256');
  hash.update(`${hostname}-${platform}-${arch}`);
  return hash.digest('hex').substring(0, 16);
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

async function readCache() {
  try {
    const content = await fs.promises.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function writeCache(data) {
  await ensureConfigDir();
  await fs.promises.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
}

async function readOfflineQueue() {
  try {
    const content = await fs.promises.readFile(OFFLINE_FILE, 'utf8');
    return JSON.parse(content);
  } catch {
    return { queue: [], lastSync: null };
  }
}

async function writeOfflineQueue(data) {
  await ensureConfigDir();
  await fs.promises.writeFile(OFFLINE_FILE, JSON.stringify(data, null, 2));
}

// ============================================================================
// API CLIENT
// ============================================================================

async function apiRequest(endpoint, method = 'GET', body = null) {
  const token = getAuthToken();
  if (!token) {
    return { success: false, error: 'No API key configured', offline: true };
  }
  
  const url = `${API_BASE_URL}${USAGE_API_PATH}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Machine-Id': getMachineId(),
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      return { 
        success: false, 
        error: data.error || `HTTP ${response.status}`,
        code: data.code,
        offline: false,
      };
    }
    
    return { success: true, ...data, offline: false };
  } catch (error) {
    // Network error - we're offline
    return { 
      success: false, 
      error: error.message, 
      offline: true,
    };
  }
}

// ============================================================================
// SERVER-AUTHORITATIVE USAGE ENFORCEMENT
// ============================================================================

class ServerUsageEnforcement {
  /**
   * Check if an action is allowed (server-authoritative)
   * This does NOT increment usage - use recordUsage() after action completes
   */
  async checkUsage(actionType) {
    // Try server first
    const result = await apiRequest('/check', 'POST', { action: actionType });
    
    if (result.offline) {
      return this.handleOfflineCheck(actionType);
    }
    
    if (!result.success) {
      // Server error - check cache as fallback
      return this.checkCachedUsage(actionType, result.error);
    }
    
    // Update cache with server response
    await this.updateCacheFromServer(result);
    
    return {
      allowed: result.allowed,
      current: result.current,
      limit: result.limit,
      remaining: result.remaining,
      reason: result.reason,
      source: 'server',
    };
  }
  
  /**
   * Record usage after action completes (server-authoritative)
   * This increments the server counter and returns updated usage
   */
  async recordUsage(actionType, count = 1) {
    // Try server first
    const result = await apiRequest('/increment', 'POST', { action: actionType, count });
    
    if (result.offline) {
      return this.handleOfflineRecord(actionType, count);
    }
    
    if (!result.success) {
      // Server error - queue for later sync
      await this.queueOfflineAction(actionType, count);
      return { 
        success: false, 
        error: result.error,
        queued: true,
      };
    }
    
    // Update cache with signed token
    if (result.signedToken) {
      await this.updateCacheWithToken(result.signedToken, result);
    }
    
    return {
      success: true,
      allowed: result.allowed,
      current: result.current,
      limit: result.limit,
      remaining: result.remaining,
      source: 'server',
    };
  }
  
  /**
   * Enforce usage limit (throws if not allowed)
   */
  async enforceLimit(actionType) {
    const check = await this.checkUsage(actionType);
    
    if (!check.allowed) {
      const error = new Error(check.reason || `Monthly ${actionType} limit reached`);
      error.code = 'LIMIT_EXCEEDED';
      error.usage = check.current;
      error.limit = check.limit;
      error.upgradePrompt = this.formatUpgradePrompt(actionType, check);
      throw error;
    }
    
    return check;
  }
  
  /**
   * Get full usage summary from server
   */
  async getUsageSummary() {
    const result = await apiRequest('/summary', 'GET');
    
    if (result.offline || !result.success) {
      // Return cached data if available
      const cache = await readCache();
      if (cache?.usage) {
        return { ...cache, source: 'cache' };
      }
      return { error: result.error || 'Unable to fetch usage', source: 'none' };
    }
    
    // Update cache
    await this.updateCacheFromServer(result);
    
    return { ...result, source: 'server' };
  }
  
  /**
   * Sync any pending offline usage to server
   */
  async syncOfflineUsage() {
    const offline = await readOfflineQueue();
    
    if (!offline.queue || offline.queue.length === 0) {
      return { synced: 0, pending: 0 };
    }
    
    const result = await apiRequest('/sync', 'POST');
    
    if (result.offline || !result.success) {
      return { 
        synced: 0, 
        pending: offline.queue.length,
        error: result.error || 'Unable to sync',
      };
    }
    
    // Clear local queue on successful sync
    await writeOfflineQueue({ queue: [], lastSync: new Date().toISOString() });
    
    // Update cache with new token
    if (result.signedToken) {
      await this.updateCacheWithToken(result.signedToken, result);
    }
    
    return {
      synced: result.synced || offline.queue.length,
      pending: 0,
      usage: result.usage,
    };
  }
  
  /**
   * Check if sync is required before any action
   */
  async requiresSync() {
    const offline = await readOfflineQueue();
    return offline.queue && offline.queue.length >= OFFLINE_ALLOWANCE;
  }
  
  // ============================================================================
  // OFFLINE HANDLING
  // ============================================================================
  
  async handleOfflineCheck(actionType) {
    const offline = await readOfflineQueue();
    const cache = await readCache();
    
    // Check if we've exceeded offline allowance
    if (offline.queue && offline.queue.length >= OFFLINE_ALLOWANCE) {
      return {
        allowed: false,
        reason: 'Offline limit reached. Please connect to sync usage.',
        requiresSync: true,
        source: 'offline',
      };
    }
    
    // Check cached limits if available
    if (cache?.signedToken && cache?.usage) {
      const tokenExpiry = new Date(cache.signedToken.expiresAt);
      const now = new Date();
      
      // Allow some grace period for cached data
      if (tokenExpiry.getTime() + TOKEN_GRACE_PERIOD_MS > now.getTime()) {
        const actionMap = {
          scan: 'scan',
          reality: 'reality',
          agent: 'agent',
          gate: 'gate',
          fix: 'fix',
        };
        const usageKey = actionMap[actionType];
        const current = cache.usage[usageKey] || 0;
        const limit = cache.limits?.[usageKey === 'scan' ? 'scans' : usageKey] || 0;
        
        if (limit === -1 || current < limit) {
          return {
            allowed: true,
            current,
            limit,
            remaining: limit === -1 ? -1 : limit - current,
            source: 'cache',
            warning: 'Using cached data (offline)',
          };
        }
      }
    }
    
    // Allow one offline action
    return {
      allowed: true,
      source: 'offline',
      warning: 'Offline mode - action will be synced when online',
      offlineAllowance: OFFLINE_ALLOWANCE - (offline.queue?.length || 0),
    };
  }
  
  async handleOfflineRecord(actionType, count) {
    const queued = await this.queueOfflineAction(actionType, count);
    
    if (!queued) {
      return {
        success: false,
        error: 'Offline limit reached. Please connect to sync usage.',
        requiresSync: true,
      };
    }
    
    return {
      success: true,
      queued: true,
      source: 'offline',
      warning: 'Action queued for sync',
    };
  }
  
  async queueOfflineAction(actionType, count = 1) {
    const offline = await readOfflineQueue();
    
    if (offline.queue && offline.queue.length >= OFFLINE_ALLOWANCE) {
      return false;
    }
    
    offline.queue = offline.queue || [];
    offline.queue.push({
      action: actionType,
      count,
      timestamp: new Date().toISOString(),
      machineId: getMachineId(),
    });
    
    await writeOfflineQueue(offline);
    return true;
  }
  
  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================
  
  async checkCachedUsage(actionType, serverError) {
    const cache = await readCache();
    
    if (!cache?.signedToken || !cache?.usage) {
      return {
        allowed: false,
        error: serverError || 'Unable to verify usage',
        source: 'none',
      };
    }
    
    // Check token expiry
    const tokenExpiry = new Date(cache.signedToken.expiresAt);
    if (tokenExpiry < new Date()) {
      return {
        allowed: false,
        error: 'Cached usage expired. Please try again.',
        source: 'cache_expired',
      };
    }
    
    const actionMap = {
      scan: 'scan',
      reality: 'reality',
      agent: 'agent',
      gate: 'gate',
      fix: 'fix',
    };
    const usageKey = actionMap[actionType];
    const current = cache.usage[usageKey] || 0;
    const limitKey = usageKey === 'scan' ? 'scans' : usageKey;
    const limit = cache.limits?.[limitKey] || 0;
    
    const allowed = limit === -1 || current < limit;
    
    return {
      allowed,
      current,
      limit,
      remaining: limit === -1 ? -1 : Math.max(0, limit - current),
      source: 'cache',
      warning: 'Using cached data due to server error',
    };
  }
  
  async updateCacheFromServer(serverResponse) {
    const cache = await readCache() || {};
    
    cache.usage = serverResponse.usage;
    cache.limits = serverResponse.limits;
    cache.tier = serverResponse.tier;
    cache.period = serverResponse.period;
    cache.lastUpdated = new Date().toISOString();
    
    if (serverResponse.signedToken) {
      cache.signedToken = serverResponse.signedToken;
    }
    
    await writeCache(cache);
  }
  
  async updateCacheWithToken(signedToken, serverResponse) {
    const cache = await readCache() || {};
    
    cache.signedToken = signedToken;
    cache.usage = serverResponse.usage || cache.usage;
    cache.limits = serverResponse.limits || cache.limits;
    cache.lastUpdated = new Date().toISOString();
    
    await writeCache(cache);
  }
  
  // ============================================================================
  // UI HELPERS
  // ============================================================================
  
  formatUpgradePrompt(actionType, check) {
    const lines = [
      '',
      '\x1b[31m╭─────────────────────────────────────────────────────────────╮\x1b[0m',
      '\x1b[31m│\x1b[0m  \x1b[1m⚠️  MONTHLY LIMIT REACHED\x1b[0m                                   \x1b[31m│\x1b[0m',
      '\x1b[31m├─────────────────────────────────────────────────────────────┤\x1b[0m',
      `\x1b[31m│\x1b[0m  ${actionType}: \x1b[33m${check.current}/${check.limit}\x1b[0m used this month`.padEnd(72) + '\x1b[31m│\x1b[0m',
      '\x1b[31m├─────────────────────────────────────────────────────────────┤\x1b[0m',
      '\x1b[31m│\x1b[0m  \x1b[36m→ guardrail upgrade\x1b[0m                                        \x1b[31m│\x1b[0m',
      '\x1b[31m│\x1b[0m  \x1b[36m→ https://guardrailai.dev/pricing\x1b[0m                          \x1b[31m│\x1b[0m',
      '\x1b[31m╰─────────────────────────────────────────────────────────────╯\x1b[0m',
      '',
    ];
    return lines.join('\n');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

const serverUsage = new ServerUsageEnforcement();

module.exports = {
  serverUsage,
  checkUsage: (actionType) => serverUsage.checkUsage(actionType),
  recordUsage: (actionType, count) => serverUsage.recordUsage(actionType, count),
  enforceLimit: (actionType) => serverUsage.enforceLimit(actionType),
  getUsageSummary: () => serverUsage.getUsageSummary(),
  syncOfflineUsage: () => serverUsage.syncOfflineUsage(),
  requiresSync: () => serverUsage.requiresSync(),
  OFFLINE_ALLOWANCE,
};
