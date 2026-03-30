/**
 * Database Utilities
 * 
 * Essential database helpers that AI agents often miss
 * Connection pooling, transactions, query helpers
 */

import { Pool, PoolClient, QueryResult } from 'pg';

let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export const initDatabase = (connectionString: string): Pool => {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString,
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
  });

  return pool;
};

/**
 * Get database pool
 */
export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return pool;
};

/**
 * Execute query with automatic connection management
 */
export const query = async <T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const db = getPool();
  return db.query<T>(text, params);
};

/**
 * Execute transaction
 */
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const db = getPool();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Close database pool
 */
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

/**
 * Health check for database
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

