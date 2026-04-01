/**
 * SQL Safety Utilities Tests
 */

import {
  assertNoSqlInjection,
  assertValidOrderColumn,
  assertValidUsageColumn,
  createColumnValidator,
  detectSqlInjection,
  isValidOrderDirection,
  isValidTable,
  isValidUsageColumn,
  safeOrderBy,
  sanitizeIdentifier,
} from "../sql-safety";

describe("SQL Safety Utilities", () => {
  describe("Usage Column Validation", () => {
    it("should accept valid usage columns", () => {
      expect(isValidUsageColumn("scan_count")).toBe(true);
      expect(isValidUsageColumn("reality_count")).toBe(true);
      expect(isValidUsageColumn("agent_count")).toBe(true);
      expect(isValidUsageColumn("gate_count")).toBe(true);
      expect(isValidUsageColumn("fix_count")).toBe(true);
    });

    it("should reject invalid usage columns", () => {
      expect(isValidUsageColumn("invalid_column")).toBe(false);
      expect(isValidUsageColumn("")).toBe(false);
      expect(isValidUsageColumn("scan_count; DROP TABLE users;--")).toBe(false);
    });

    it("should throw for invalid columns with assert", () => {
      expect(() => assertValidUsageColumn("scan_count")).not.toThrow();
      expect(() => assertValidUsageColumn("malicious")).toThrow(
        /Invalid usage column/,
      );
    });

    it("should prevent prototype pollution attacks", () => {
      // Simulate prototype pollution attempt
      const polluted = { toString: () => "scan_count" };
      expect(isValidUsageColumn(polluted as any)).toBe(false);
    });
  });

  describe("Generic Column Validator", () => {
    const validator = createColumnValidator(
      ["id", "name", "email"] as const,
      "users",
    );

    it("should validate allowed columns", () => {
      expect(validator.isValid("id")).toBe(true);
      expect(validator.isValid("name")).toBe(true);
      expect(validator.isValid("invalid")).toBe(false);
    });

    it("should assert valid columns", () => {
      expect(() => validator.assert("id")).not.toThrow();
      expect(() => validator.assert("invalid")).toThrow(/Invalid column/);
    });
  });

  describe("ORDER BY Validation", () => {
    it("should validate order columns for tables", () => {
      expect(() => assertValidOrderColumn("created_at", "scans")).not.toThrow();
      expect(() => assertValidOrderColumn("invalid", "scans")).toThrow();
    });

    it("should validate order direction", () => {
      expect(isValidOrderDirection("ASC")).toBe(true);
      expect(isValidOrderDirection("DESC")).toBe(true);
      expect(isValidOrderDirection("asc")).toBe(true);
      expect(isValidOrderDirection("INVALID")).toBe(false);
    });

    it("should build safe ORDER BY clauses", () => {
      expect(safeOrderBy("created_at", "desc", "scans")).toBe(
        "created_at DESC",
      );
      expect(() => safeOrderBy("malicious", "asc", "scans")).toThrow();
    });
  });

  describe("Table Name Validation", () => {
    it("should accept valid table names", () => {
      expect(isValidTable("users")).toBe(true);
      expect(isValidTable("projects")).toBe(true);
      expect(isValidTable("scans")).toBe(true);
    });

    it("should reject invalid table names", () => {
      expect(isValidTable("invalid_table")).toBe(false);
      expect(isValidTable("users; DROP TABLE users;--")).toBe(false);
    });
  });

  describe("Identifier Sanitization", () => {
    it("should sanitize unsafe characters", () => {
      expect(sanitizeIdentifier("valid_column")).toBe("valid_column");
      expect(sanitizeIdentifier("column123")).toBe("column123");
    });

    it("should remove SQL injection characters", () => {
      expect(sanitizeIdentifier("col;DROP")).toBe("colDROP");
      expect(sanitizeIdentifier("col'OR'1")).toBe("colOR1");
    });

    it("should reject identifiers starting with numbers", () => {
      expect(() => sanitizeIdentifier("123column")).toThrow(
        /must start with letter/,
      );
    });

    it("should reject overly long identifiers", () => {
      const longId = "a".repeat(100);
      expect(() => sanitizeIdentifier(longId)).toThrow(/too long/);
    });
  });

  describe("SQL Injection Detection", () => {
    it("should detect common SQL injection patterns", () => {
      expect(detectSqlInjection("'; DROP TABLE users;--")).toBe(true);
      expect(detectSqlInjection("1 OR 1=1")).toBe(true);
      expect(detectSqlInjection("UNION SELECT * FROM users")).toBe(true);
      expect(detectSqlInjection("/* comment */")).toBe(true);
    });

    it("should not flag safe strings", () => {
      expect(detectSqlInjection("normal_value")).toBe(false);
      expect(detectSqlInjection("john.doe@email.com")).toBe(false);
      expect(detectSqlInjection("12345")).toBe(false);
    });

    it("should throw with assertion function", () => {
      expect(() => assertNoSqlInjection("safe_value")).not.toThrow();
      expect(() => assertNoSqlInjection("'; DROP TABLE--")).toThrow(
        /SQL injection/,
      );
    });
  });
});
