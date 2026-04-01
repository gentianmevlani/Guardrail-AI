/**
 * SQL Safety Utilities
 *
 * Runtime validation for dynamic SQL construction to prevent injection attacks.
 * These utilities provide defense-in-depth beyond TypeScript's compile-time safety.
 */

// ============================================================================
// USAGE COUNTER COLUMNS
// ============================================================================

/**
 * Whitelist of allowed columns for usage_counters table.
 * Single source of truth for runtime validation.
 */
export const ALLOWED_USAGE_COLUMNS = [
  "scan_count",
  "reality_count",
  "agent_count",
  "gate_count",
  "fix_count",
] as const;

export type UsageColumn = (typeof ALLOWED_USAGE_COLUMNS)[number];

/**
 * Type guard to validate if a string is a valid usage column.
 */
export function isValidUsageColumn(column: string): column is UsageColumn {
  return ALLOWED_USAGE_COLUMNS.includes(column as UsageColumn);
}

/**
 * Assertion function that throws if column is invalid.
 * Use this before any dynamic SQL construction.
 */
export function assertValidUsageColumn(
  column: string,
): asserts column is UsageColumn {
  if (!isValidUsageColumn(column)) {
    throw new Error(
      `Invalid usage column: "${column}". Allowed columns: ${ALLOWED_USAGE_COLUMNS.join(", ")}`,
    );
  }
}

// ============================================================================
// GENERIC COLUMN VALIDATION
// ============================================================================

/**
 * Creates a column validator for a specific table's allowed columns.
 * Factory function for creating table-specific validators.
 */
export function createColumnValidator<T extends readonly string[]>(
  allowedColumns: T,
  tableName: string,
) {
  type Column = T[number];

  return {
    isValid: (column: string): column is Column => {
      return allowedColumns.includes(column as Column);
    },

    assert: (column: string): asserts column is Column => {
      if (!allowedColumns.includes(column as Column)) {
        throw new Error(
          `Invalid column "${column}" for table "${tableName}". ` +
            `Allowed: ${allowedColumns.join(", ")}`,
        );
      }
    },

    allowedColumns,
  };
}

// ============================================================================
// ORDER BY VALIDATION
// ============================================================================

/**
 * Whitelist of allowed ORDER BY columns across common tables.
 * Add new columns here as needed.
 */
export const ALLOWED_ORDER_COLUMNS = {
  scans: ["created_at", "updated_at", "status", "score", "name"] as const,
  projects: ["created_at", "updated_at", "name", "status"] as const,
  users: ["created_at", "email", "name"] as const,
  findings: ["created_at", "severity", "status", "type"] as const,
  usage_counters: [
    "period_start",
    "period_end",
    "updated_at",
    "scan_count",
  ] as const,
} as const;

export type OrderColumn<T extends keyof typeof ALLOWED_ORDER_COLUMNS> =
  (typeof ALLOWED_ORDER_COLUMNS)[T][number];

/**
 * Validates ORDER BY column for a specific table.
 */
export function assertValidOrderColumn<
  T extends keyof typeof ALLOWED_ORDER_COLUMNS,
>(column: string, table: T): asserts column is OrderColumn<T> {
  const allowedColumns = ALLOWED_ORDER_COLUMNS[table] as readonly string[];
  if (!allowedColumns.includes(column)) {
    throw new Error(
      `Invalid ORDER BY column "${column}" for table "${table}". ` +
        `Allowed: ${allowedColumns.join(", ")}`,
    );
  }
}

// ============================================================================
// ORDER DIRECTION VALIDATION
// ============================================================================

export const ALLOWED_ORDER_DIRECTIONS = ["ASC", "DESC", "asc", "desc"] as const;
export type OrderDirection = (typeof ALLOWED_ORDER_DIRECTIONS)[number];

export function isValidOrderDirection(
  direction: string,
): direction is OrderDirection {
  return ALLOWED_ORDER_DIRECTIONS.includes(direction as OrderDirection);
}

export function assertValidOrderDirection(
  direction: string,
): asserts direction is OrderDirection {
  if (!isValidOrderDirection(direction)) {
    throw new Error(
      `Invalid ORDER direction: "${direction}". Allowed: ASC, DESC`,
    );
  }
}

/**
 * Safely construct ORDER BY clause with validated column and direction.
 */
export function safeOrderBy<T extends keyof typeof ALLOWED_ORDER_COLUMNS>(
  column: string,
  direction: string,
  table: T,
): string {
  assertValidOrderColumn(column, table);
  assertValidOrderDirection(direction);
  return `${column} ${direction.toUpperCase()}`;
}

// ============================================================================
// TABLE NAME VALIDATION
// ============================================================================

export const ALLOWED_TABLES = [
  "users",
  "projects",
  "scans",
  "findings",
  "api_keys",
  "usage_counters",
  "usage_tokens",
  "offline_usage_queue",
  "organizations",
  "organization_members",
  "subscriptions",
  "invoices",
  "audit_logs",
  "webhooks",
  "notifications",
] as const;

export type AllowedTable = (typeof ALLOWED_TABLES)[number];

export function isValidTable(table: string): table is AllowedTable {
  return ALLOWED_TABLES.includes(table as AllowedTable);
}

export function assertValidTable(table: string): asserts table is AllowedTable {
  if (!isValidTable(table)) {
    throw new Error(
      `Invalid table name: "${table}". This table is not in the allowed list.`,
    );
  }
}

// ============================================================================
// IDENTIFIER SANITIZATION
// ============================================================================

/**
 * Sanitizes SQL identifiers (column/table names) by removing unsafe characters.
 * This is a last-resort defense - prefer whitelist validation instead.
 */
export function sanitizeIdentifier(identifier: string): string {
  // Only allow alphanumeric and underscore
  const sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, "");

  // Must start with letter or underscore
  if (!/^[a-zA-Z_]/.test(sanitized)) {
    throw new Error(
      `Invalid identifier: "${identifier}" - must start with letter or underscore`,
    );
  }

  // Limit length
  if (sanitized.length > 64) {
    throw new Error(`Identifier too long: "${identifier}" - max 64 characters`);
  }

  return sanitized;
}

// ============================================================================
// SQL INJECTION PATTERN DETECTION
// ============================================================================

const SQL_INJECTION_PATTERNS = [
  /--/, // SQL comment
  /;/, // Statement terminator
  /\/\*/, // Block comment start
  /\*\//, // Block comment end
  /'/, // Single quote
  /"/, // Double quote
  /\bOR\b.*=/i, // OR injection
  /\bAND\b.*=/i, // AND injection
  /\bUNION\b/i, // UNION injection
  /\bSELECT\b/i, // SELECT injection
  /\bINSERT\b/i, // INSERT injection
  /\bUPDATE\b/i, // UPDATE injection
  /\bDELETE\b/i, // DELETE injection
  /\bDROP\b/i, // DROP injection
  /\bEXEC\b/i, // EXEC injection
  /\bxp_/i, // Extended stored procedures
];

/**
 * Detects potential SQL injection patterns in a string.
 * Returns true if suspicious patterns are found.
 */
export function detectSqlInjection(value: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Throws if SQL injection patterns are detected.
 */
export function assertNoSqlInjection(
  value: string,
  context: string = "input",
): void {
  if (detectSqlInjection(value)) {
    throw new Error(
      `Potential SQL injection detected in ${context}: "${value}"`,
    );
  }
}
