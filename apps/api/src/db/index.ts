/**
 * Database Access Layer (DAL)
 *
 * Centralized database operations with typed interfaces.
 * All database access should go through this layer.
 */

import { pool } from '@guardrail/database';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

// Singleton Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaClient = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClient;

// Export singleton Prisma client (regenerate client after schema changes: pnpm --filter @guardrail/database db:generate)
export const prisma: PrismaClient = prismaClient;

// ============================================================================
// RAW SQL QUERIES (for complex queries that Prisma can't handle efficiently)
// ============================================================================

export interface RawQueryOptions {
  /**
   * Justification for using raw SQL instead of Prisma
   * Examples: "Complex JOIN with window functions", "Performance-critical aggregation"
   */
  justification: string;
}

/**
 * Execute raw SQL with typed results
 * Only use for queries that Prisma cannot handle efficiently
 */
export async function rawQuery<T = any>(
  sql: string,
  params: unknown[] = [],
  options?: RawQueryOptions
): Promise<{ rows: T[] }> {
  if (process.env.NODE_ENV === 'development' && options?.justification) {
    logger.warn({ justification: options.justification, component: 'database-dal' }, 'Raw SQL query executed');
  }

  return pool.query<T>(sql, params);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  prisma,
  rawQuery,
};
