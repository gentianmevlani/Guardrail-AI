import { PrismaClient, Prisma } from "@prisma/client";

// Environment detection
const isProduction = process.env["NODE_ENV"] === "production";
const isDevelopment = process.env["NODE_ENV"] === "development";

// Slow query threshold (ms)
const SLOW_QUERY_THRESHOLD = 5000;

// Connection pool configuration via DATABASE_URL params
// For production: ?connection_limit=20&pool_timeout=30
// Prisma handles connection pooling automatically via the connection string

// Singleton pattern for Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create Prisma Client with logging configuration
 */
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: isDevelopment
      ? [
          { emit: "event", level: "query" },
          { emit: "stdout", level: "error" },
          { emit: "stdout", level: "warn" },
        ]
      : [{ emit: "stdout", level: "error" }],
    errorFormat: isDevelopment ? "pretty" : "minimal",
  });

  // Add slow query logging in development
  if (isDevelopment) {
    (client as any).$on("query", (e: any) => {
      if (e.duration > SLOW_QUERY_THRESHOLD) {
        console.warn(`⚠️ Slow query (${e.duration}ms): ${e.query}`);
      }
    });
  }

  return client;
}

/**
 * Enhanced Prisma Client with:
 * - Connection pooling (via DATABASE_URL params)
 * - Query logging in development
 * - Slow query warnings (>5s)
 * - Error logging in all environments
 */
const prismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = prismaClient;
}

// Export prisma cast to any to handle models/fields that may not be in generated client yet
// These models exist in schema.prisma but client needs regeneration after schema changes
// Run `pnpm --filter @guardrail/database db:generate` to update types
export const prisma = prismaClient as any;

// Re-export Prisma types
export * from "@prisma/client";
export { Prisma };

// Re-export Zod validation schemas for Json fields
export * from "./schemas";

// ==========================================
// HEALTH CHECK UTILITIES
// ==========================================

export interface DbHealthResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
  timestamp: number;
}

let poolHealthy = true;
let lastHealthCheck = Date.now();

/**
 * Check if database connection is healthy with latency measurement
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    poolHealthy = true;
    lastHealthCheck = Date.now();
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    poolHealthy = false;
    return false;
  }
}

/**
 * Comprehensive database health check
 */
export async function checkDbHealth(): Promise<DbHealthResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    poolHealthy = true;
    lastHealthCheck = Date.now();

    return {
      healthy: true,
      latencyMs,
      timestamp: lastHealthCheck,
    };
  } catch (error: any) {
    poolHealthy = false;
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      message: error.message,
      timestamp: Date.now(),
    };
  }
}

/**
 * Get cached pool health status (avoids hammering the DB)
 */
export function getPoolHealth(): { healthy: boolean; lastCheck: number } {
  return { healthy: poolHealthy, lastCheck: lastHealthCheck };
}

// ==========================================
// QUERY UTILITIES
// ==========================================

/**
 * Execute a query with timeout protection
 */
export async function queryWithTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = 5000,
): Promise<T> {
  return Promise.race([
    queryFn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Database query timeout")), timeoutMs),
    ),
  ]);
}

/**
 * Execute raw SQL query (for complex queries Prisma can't handle)
 */
export async function rawQuery<T = unknown>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  return prismaClient.$queryRawUnsafe<T>(sql, ...params);
}

/**
 * Execute raw SQL command (INSERT, UPDATE, DELETE)
 */
export async function rawExecute(
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  return prismaClient.$executeRawUnsafe(sql, ...params);
}

// ==========================================
// TRANSACTION UTILITIES
// ==========================================

/**
 * Execute multiple operations in a transaction
 * Prisma automatically rolls back on error
 */
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  },
): Promise<T> {
  return prisma.$transaction(fn, {
    maxWait: options?.maxWait ?? 5000,
    timeout: options?.timeout ?? 10000,
    isolationLevel: options?.isolationLevel,
  });
}

/**
 * Batch multiple independent operations in a transaction
 */
export async function batchTransaction<
  T extends Prisma.PrismaPromise<unknown>[],
>(operations: [...T]): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  return prisma.$transaction(operations) as Promise<{
    [K in keyof T]: Awaited<T[K]>;
  }>;
}

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

let isShuttingDown = false;

/**
 * Gracefully disconnect from the database
 */
export async function disconnectDatabase(): Promise<void> {
  if (isShuttingDown) {
    console.warn("Database disconnect already in progress");
    return;
  }
  isShuttingDown = true;

  try {
    console.log("Closing database connections...");
    await prisma.$disconnect();
    console.log("Database connections closed");
  } catch (error) {
    console.error("Error closing database connections:", error);
    throw error;
  }
}

// Alias for backwards compatibility with old Drizzle code
export const closePool = disconnectDatabase;

/**
 * Setup graceful shutdown handlers
 * Call this once at application startup
 */
export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, initiating graceful shutdown...`);
    await disconnectDatabase();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// ==========================================
// MIGRATION HELPERS (for transitioning from Drizzle)
// ==========================================

/**
 * Query result type matching pg Pool interface
 */
export interface QueryResult<T = Record<string, any>> {
  rows: T[];
  rowCount: number;
}

/**
 * Helper to run parameterized queries similar to pg pool.query()
 * Use this for migrating raw SQL queries from Drizzle/pg
 *
 * @example
 * // With type parameter for typed results
 * const result = await query<{ id: string; email: string }>(
 *   'SELECT id, email FROM users WHERE id = $1',
 *   [userId]
 * );
 * // result.rows[0].id is typed as string
 */
export async function query<T = Record<string, any>>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const results = await prismaClient.$queryRawUnsafe<T[]>(sql, ...params);
  return {
    rows: results,
    rowCount: results.length,
  };
}

/**
 * Execute a SQL command (INSERT, UPDATE, DELETE) and return affected row count
 */
export async function execute(
  sql: string,
  params: unknown[] = [],
): Promise<{ rowCount: number }> {
  const count = await prismaClient.$executeRawUnsafe(sql, ...params);
  return { rowCount: count };
}

/**
 * Pool connection interface for compatibility
 */
export interface PoolConnection {
  query: <T = Record<string, any>>(
    sql: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
  release: () => void;
}

/**
 * Get a "connection" that mimics pg pool behavior for complex migrations
 * Returns an object with query method for compatibility
 */
export function getConnection(): PoolConnection {
  return {
    query: async <T = Record<string, any>>(
      sql: string,
      params: unknown[] = [],
    ) => {
      return query<T>(sql, params);
    },
    release: () => {
      // No-op: Prisma manages connections automatically
    },
  };
}

/**
 * Pool interface for backward compatibility
 * Mimics pg Pool API for gradual migration
 */
export interface Pool {
  query: <T = Record<string, any>>(
    sql: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
  connect: () => Promise<PoolConnection>;
  end: () => Promise<void>;
}

// Export the pool-like interface for backward compatibility during migration
export const pool: Pool = {
  query: async <T = Record<string, any>>(
    sql: string,
    params: unknown[] = [],
  ) => {
    return query<T>(sql, params);
  },
  connect: async () => getConnection(),
  end: disconnectDatabase,
};
