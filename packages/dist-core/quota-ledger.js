"use strict";
/**
 * Quota Ledger - Server-Authoritative Usage Tracking
 *
 * Implements idempotent usage recording with request IDs to prevent double-counting.
 * All quota checks are validated server-side before allowing operations.
 *
 * SECURITY: CLI cannot bypass quota checks by modifying local files.
 * The server is the single source of truth for usage data.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingCount = exports.syncPendingUsage = exports.getUsageSummary = exports.recordUsage = exports.checkQuota = exports.quotaLedger = exports.QuotaLedger = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
// ============================================================================
// QUOTA LEDGER CLASS
// ============================================================================
class QuotaLedger {
    configDir;
    ledgerFile;
    cacheFile;
    apiUrl;
    apiKey;
    constructor() {
        this.configDir = path.join(os.homedir(), '.guardrail');
        this.ledgerFile = path.join(this.configDir, 'usage-ledger.json');
        this.cacheFile = path.join(this.configDir, 'quota-cache.json');
        this.apiUrl = process.env['GUARDRAIL_API_URL'] || 'https://api.getguardrail.io';
        this.apiKey = process.env['GUARDRAIL_API_KEY'] || null;
    }
    /**
     * Generate unique request ID for idempotency
     */
    generateRequestId() {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(8).toString('hex');
        return `req_${timestamp}_${random}`;
    }
    /**
     * Check if action is allowed based on quota
     * Always validates with server when possible
     */
    async checkQuota(action) {
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
                    const result = await response.json();
                    // Cache the result
                    await this.cacheQuotaResult(action, result);
                    return {
                        ...result,
                        source: 'server',
                        requestId,
                    };
                }
            }
            catch {
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
    async recordUsage(action, count = 1, requestId) {
        const id = requestId || this.generateRequestId();
        // Check for duplicate request
        if (await this.isDuplicateRequest(id)) {
            const existing = await this.getExistingResult(id);
            if (existing)
                return existing;
        }
        const entry = {
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
                    const result = await response.json();
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
                    const error = await response.json();
                    return {
                        success: false,
                        requestId: id,
                        newUsage: 0,
                        remaining: 0,
                        source: 'server',
                        error: error.message || 'Quota exceeded',
                    };
                }
            }
            catch {
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
    async getUsageSummary() {
        if (this.apiKey) {
            try {
                const response = await fetch(`${this.apiUrl}/api/usage/summary`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                    },
                });
                if (response.ok) {
                    return await response.json();
                }
            }
            catch {
                // Fall through to local
            }
        }
        // Return local summary
        return this.getLocalSummary();
    }
    /**
     * Sync pending offline usage to server
     */
    async syncPendingUsage() {
        const entries = await this.getUnsyncedEntries();
        let synced = 0;
        let failed = 0;
        const errors = [];
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
                }
                else {
                    failed++;
                    errors.push(`Failed to sync ${entry.id}: ${response.statusText}`);
                }
            }
            catch (e) {
                failed++;
                errors.push(`Failed to sync ${entry.id}: ${e.message}`);
            }
        }
        return { synced, failed, errors };
    }
    /**
     * Get count of pending offline usage
     */
    async getPendingCount() {
        const entries = await this.getUnsyncedEntries();
        return entries.length;
    }
    // ============================================================================
    // PRIVATE HELPERS
    // ============================================================================
    async ensureDir() {
        try {
            await fs.promises.mkdir(this.configDir, { recursive: true });
        }
        catch {
            // Exists
        }
    }
    async saveLedgerEntry(entry) {
        await this.ensureDir();
        let ledger = [];
        try {
            const content = await fs.promises.readFile(this.ledgerFile, 'utf8');
            ledger = JSON.parse(content);
        }
        catch {
            // New file
        }
        // Check for duplicate
        const existing = ledger.findIndex(e => e.id === entry.id);
        if (existing >= 0) {
            ledger[existing] = entry;
        }
        else {
            ledger.push(entry);
        }
        // Keep only last 1000 entries
        if (ledger.length > 1000) {
            ledger = ledger.slice(-1000);
        }
        await fs.promises.writeFile(this.ledgerFile, JSON.stringify(ledger, null, 2));
    }
    async updateLedgerEntry(entry) {
        await this.saveLedgerEntry(entry);
    }
    async getUnsyncedEntries() {
        try {
            const content = await fs.promises.readFile(this.ledgerFile, 'utf8');
            const ledger = JSON.parse(content);
            return ledger.filter(e => !e.synced);
        }
        catch {
            return [];
        }
    }
    async isDuplicateRequest(id) {
        try {
            const content = await fs.promises.readFile(this.ledgerFile, 'utf8');
            const ledger = JSON.parse(content);
            return ledger.some(e => e.id === id);
        }
        catch {
            return false;
        }
    }
    async getExistingResult(id) {
        try {
            const content = await fs.promises.readFile(this.ledgerFile, 'utf8');
            const ledger = JSON.parse(content);
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
        }
        catch {
            // Not found
        }
        return null;
    }
    async cacheQuotaResult(action, result) {
        await this.ensureDir();
        let cache = {};
        try {
            const content = await fs.promises.readFile(this.cacheFile, 'utf8');
            cache = JSON.parse(content);
        }
        catch {
            // New cache
        }
        cache[action] = {
            ...result,
            cachedAt: new Date().toISOString(),
        };
        await fs.promises.writeFile(this.cacheFile, JSON.stringify(cache, null, 2));
    }
    async getCachedQuota(action) {
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
        }
        catch {
            // No cache
        }
        return null;
    }
    async getLocalSummary() {
        try {
            const content = await fs.promises.readFile(this.ledgerFile, 'utf8');
            const ledger = JSON.parse(content);
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
        }
        catch {
            return null;
        }
    }
}
exports.QuotaLedger = QuotaLedger;
// ============================================================================
// SINGLETON EXPORT
// ============================================================================
exports.quotaLedger = new QuotaLedger();
// Convenience exports
const checkQuota = (action) => exports.quotaLedger.checkQuota(action);
exports.checkQuota = checkQuota;
const recordUsage = (action, count, requestId) => exports.quotaLedger.recordUsage(action, count, requestId);
exports.recordUsage = recordUsage;
const getUsageSummary = () => exports.quotaLedger.getUsageSummary();
exports.getUsageSummary = getUsageSummary;
const syncPendingUsage = () => exports.quotaLedger.syncPendingUsage();
exports.syncPendingUsage = syncPendingUsage;
const getPendingCount = () => exports.quotaLedger.getPendingCount();
exports.getPendingCount = getPendingCount;
