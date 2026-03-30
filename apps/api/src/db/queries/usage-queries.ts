/**
 * Data Access Layer - Usage Queries
 *
 * These queries require raw SQL for performance or complex operations
 * that Prisma cannot efficiently handle. All functions have typed inputs/outputs
 * and explicit justification for using raw SQL.
 */

import { pool } from "@guardrail/database";
import { UsageColumn, assertValidUsageColumn } from "../../utils/sql-safety";

// ============================================================================
// USAGE COUNTERS - Performance Critical
// ============================================================================
/**
 * Get or create usage counter for a user's billing period
 *
 * Justification: This uses ON CONFLICT DO UPDATE which is more efficient
 * than separate find + create operations in Prisma for high-frequency usage tracking
 */
export async function getOrCreateUsageCounter(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{
  id: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  scanCount: number;
  realityCount: number;
  agentCount: number;
  gateCount: number;
  fixCount: number;
  updatedAt: Date;
}> {
  const result = await pool.query(
    `INSERT INTO usage_counters (id, user_id, period_start, period_end, scan_count, reality_count, agent_count, gate_count, fix_count, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, 0, 0, 0, 0, 0, NOW())
       ON CONFLICT (user_id, period_start) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
    [userId, periodStart, periodEnd],
  );

  return result.rows[0] as any;
}

/**
 * Atomically increment usage counter
 *
 * Justification: Atomic increment prevents race conditions in high-concurrency usage tracking
 */
export async function incrementUsageCounter(
  userId: string,
  periodStart: Date,
  column: UsageColumn,
  count: number = 1,
): Promise<{ updated: boolean; currentCount: number }> {
  // SECURITY: Runtime validation to prevent SQL injection via prototype pollution
  // or type coercion attacks. Defense-in-depth beyond TypeScript compile-time safety.
  assertValidUsageColumn(column);

  // Now safe to use in SQL - column is guaranteed to be one of the allowed values
  const result = await pool.query(
    `INSERT INTO usage_counters (id, user_id, period_start, period_end, ${column}, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, NOW(), $3, NOW())
       ON CONFLICT (user_id, period_start) 
       DO UPDATE SET ${column} = usage_counters.${column} + $3, updated_at = NOW()
       RETURNING ${column} as current_count`,
    [userId, periodStart, count],
  );

  return {
    updated: true,
    currentCount: parseInt(result.rows[0].current_count),
  };
}

// ============================================================================
// USAGE TOKENS - Security Critical
// ============================================================================
/**
 * Store usage token with HMAC signature
 *
 * Justification: Security-sensitive operation that needs exact control over
 * token storage and verification logic
 */
export async function storeUsageToken(
  userId: string,
  tokenHash: string,
  signature: string,
  payload: any,
  issuedAt: Date,
  expiresAt: Date,
): Promise<void> {
  await pool.query(
    `INSERT INTO usage_tokens (id, user_id, token_hash, signature, payload, issued_at, expires_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)`,
    [
      userId,
      tokenHash,
      signature,
      JSON.stringify(payload),
      issuedAt,
      expiresAt,
    ],
  );
}

/**
 * Verify and retrieve usage token
 *
 * Justification: Security verification needs exact control over query logic
 */
export async function verifyUsageToken(tokenHash: string): Promise<{
  id: string;
  userId: string;
  tokenHash: string;
  signature: string;
  payload: any;
  issuedAt: Date;
  expiresAt: Date;
  revoked: boolean;
} | null> {
  const result = await pool.query(
    `SELECT * FROM usage_tokens WHERE token_hash = $1 AND revoked = false AND expires_at > NOW()`,
    [tokenHash],
  );

  return (result.rows[0] || null) as any;
}

/**
 * Revoke usage token
 *
 * Justification: Security operation needs exact control
 */
export async function revokeUsageToken(tokenHash: string): Promise<void> {
  await pool.query(
    `UPDATE usage_tokens SET revoked = true WHERE token_hash = $1`,
    [tokenHash],
  );
}

/**
 * Revoke all user tokens
 *
 * Justification: Security operation for logout/suspension
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await pool.query(
    `UPDATE usage_tokens SET revoked = true WHERE user_id = $1`,
    [userId],
  );
}

// ============================================================================
// OFFLINE USAGE QUEUE - Performance Critical
// ============================================================================
/**
 * Queue offline usage action
 *
 * Justification: High-frequency operation that needs to be fast and reliable
 */
export async function queueOfflineUsage(
  userId: string,
  actionType: string,
  machineId?: string,
): Promise<{ queued: boolean; offlineCount: number }> {
  // Check current queue size
  const countResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM offline_usage_queue WHERE user_id = $1 AND synced = false`,
    [userId],
  );
  const offlineCount = parseInt(countResult.rows[0].cnt);

  // Queue the action
  await pool.query(
    `INSERT INTO offline_usage_queue (id, user_id, action_type, count, machine_id)
       VALUES (gen_random_uuid()::text, $1, $2, 1, $3)`,
    [userId, actionType, machineId],
  );

  return { queued: true, offlineCount: offlineCount + 1 };
}

/**
 * Get pending offline usage for sync
 *
 * Justification: Batch operation needs efficient retrieval
 */
export async function getPendingOfflineUsage(userId: string): Promise<
  Array<{
    id: string;
    actionType: string;
    count: number;
  }>
> {
  const result = await pool.query(
    `SELECT id, action_type, count FROM offline_usage_queue WHERE user_id = $1 AND synced = false`,
    [userId],
  );

  return result.rows as any;
}

/**
 * Mark offline usage as synced
 *
 * Justification: Batch update operation
 */
export async function markOfflineUsageSynced(usageId: string): Promise<void> {
  await pool.query(
    `UPDATE offline_usage_queue SET synced = true, synced_at = NOW() WHERE id = $1`,
    [usageId],
  );
}

/**
 * Get pending offline usage count
 *
 * Justification: Simple count query
 */
export async function getPendingOfflineCount(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as cnt FROM offline_usage_queue WHERE user_id = $1 AND synced = false`,
    [userId],
  );

  return parseInt(result.rows[0].cnt);
}

// ============================================================================
// MAINTENANCE
// ============================================================================
/**
 * Clean up expired tokens
 *
 * Justification: Maintenance operation needs exact control
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM usage_tokens WHERE expires_at < NOW() RETURNING id`,
  );
  return result.rowCount || 0;
}

/**
 * Get usage statistics for reporting
 *
 * Justification: Complex aggregation query for analytics
 */
export async function getUsageStats(
  userId?: string,
  startDate?: Date,
  endDate?: Date,
): Promise<{
  totalScans: number;
  totalReality: number;
  totalAgents: number;
  totalGates: number;
  totalFixes: number;
  period: { start: Date; end: Date } | null;
}> {
  let whereClause = "WHERE 1=1";
  const params: unknown[] = [];

  if (userId) {
    whereClause += ` AND user_id = $${params.length + 1}`;
    params.push(userId);
  }

  if (startDate) {
    whereClause += ` AND period_start >= $${params.length + 1}`;
    params.push(startDate);
  }

  if (endDate) {
    whereClause += ` AND period_end <= $${params.length + 1}`;
    params.push(endDate);
  }

  const result = await pool.query(
    `SELECT 
       COALESCE(SUM(scan_count), 0) as total_scans,
       COALESCE(SUM(reality_count), 0) as total_reality,
       COALESCE(SUM(agent_count), 0) as total_agents,
       COALESCE(SUM(gate_count), 0) as total_gates,
       COALESCE(SUM(fix_count), 0) as total_fixes,
       MIN(period_start) as period_start,
       MAX(period_end) as period_end
     FROM usage_counters ${whereClause}`,
    params,
  );

  const row = result.rows[0];
  return {
    totalScans: parseInt(row.total_scans),
    totalReality: parseInt(row.total_reality),
    totalAgents: parseInt(row.total_agents),
    totalGates: parseInt(row.total_gates),
    totalFixes: parseInt(row.total_fixes),
    period:
      row.period_start && row.period_end
        ? {
            start: new Date(row.period_start),
            end: new Date(row.period_end),
          }
        : null,
  };
}
