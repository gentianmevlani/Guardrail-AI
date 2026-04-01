/**
 * Quota Ledger - Server-Authoritative Usage Tracking
 *
 * Implements idempotent usage recording with request IDs to prevent double-counting.
 * All quota checks are validated server-side before allowing operations.
 *
 * SECURITY: CLI cannot bypass quota checks by modifying local files.
 * The server is the single source of truth for usage data.
 */
export type UsageActionType = 'scan' | 'scan_truth' | 'reality' | 'agent' | 'fix' | 'gate';
export interface UsageEntry {
    id: string;
    action: UsageActionType;
    count: number;
    timestamp: string;
    synced: boolean;
    projectId?: string;
    metadata?: Record<string, unknown>;
}
export interface QuotaLimits {
    scans: number;
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
export declare class QuotaLedger {
    private configDir;
    private ledgerFile;
    private cacheFile;
    private apiUrl;
    private apiKey;
    constructor();
    /**
     * Generate unique request ID for idempotency
     */
    generateRequestId(): string;
    /**
     * Check if action is allowed based on quota
     * Always validates with server when possible
     */
    checkQuota(action: UsageActionType): Promise<QuotaCheckResult>;
    /**
     * Record usage with idempotency guarantee
     * Uses request ID to prevent double-counting on retries
     */
    recordUsage(action: UsageActionType, count?: number, requestId?: string): Promise<RecordResult>;
    /**
     * Get usage summary for current billing period
     */
    getUsageSummary(): Promise<UsageSummary | null>;
    /**
     * Sync pending offline usage to server
     */
    syncPendingUsage(): Promise<{
        synced: number;
        failed: number;
        errors: string[];
    }>;
    /**
     * Get count of pending offline usage
     */
    getPendingCount(): Promise<number>;
    private ensureDir;
    private saveLedgerEntry;
    private updateLedgerEntry;
    private getUnsyncedEntries;
    private isDuplicateRequest;
    private getExistingResult;
    private cacheQuotaResult;
    private getCachedQuota;
    private getLocalSummary;
}
export declare const quotaLedger: QuotaLedger;
export declare const checkQuota: (action: UsageActionType) => Promise<QuotaCheckResult>;
export declare const recordUsage: (action: UsageActionType, count?: number, requestId?: string) => Promise<RecordResult>;
export declare const getUsageSummary: () => Promise<UsageSummary | null>;
export declare const syncPendingUsage: () => Promise<{
    synced: number;
    failed: number;
    errors: string[];
}>;
export declare const getPendingCount: () => Promise<number>;
//# sourceMappingURL=quota-ledger.d.ts.map