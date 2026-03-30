/**
 * Path Safety Utilities
 *
 * Runtime validation and sanitization for file paths to prevent
 * path traversal attacks and directory escape vulnerabilities.
 */

import * as path from "path";
import { logger } from "../logger";

// ============================================================================
// PATH TRAVERSAL PREVENTION
// ============================================================================

/**
 * Patterns that indicate path traversal attempts
 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\./, // Parent directory traversal
  /\.\.\\/, // Windows parent traversal
  /\.\.\//, // Unix parent traversal
  /%2e%2e/i, // URL encoded ..
  /%252e%252e/i, // Double URL encoded ..
  /\0/, // Null byte injection
  /%00/, // URL encoded null byte
];

/**
 * Dangerous path prefixes on different systems
 */
const DANGEROUS_PREFIXES = [
  "/etc/",
  "/var/",
  "/usr/",
  "/root/",
  "/home/",
  "/proc/",
  "/sys/",
  "C:\\Windows",
  "C:\\System",
  "C:\\Users",
];

/**
 * Check if a path contains traversal patterns
 */
export function containsTraversal(inputPath: string): boolean {
  return PATH_TRAVERSAL_PATTERNS.some((pattern) => pattern.test(inputPath));
}

/**
 * Check if a path attempts to access dangerous locations
 */
export function isDangerousPath(inputPath: string): boolean {
  const normalizedPath = path.normalize(inputPath).toLowerCase();
  return DANGEROUS_PREFIXES.some((prefix) =>
    normalizedPath.startsWith(prefix.toLowerCase()),
  );
}

// ============================================================================
// FILENAME SANITIZATION
// ============================================================================

/**
 * Characters allowed in sanitized filenames
 * Alphanumeric, dash, underscore, and period only
 */
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9._-]+$/;

/**
 * Maximum filename length
 */
const MAX_FILENAME_LENGTH = 255;

/**
 * Reserved filenames on Windows
 */
const WINDOWS_RESERVED = [
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
];

export interface SanitizeOptions {
  /** Maximum length for the filename (default: 255) */
  maxLength?: number;
  /** Replacement character for unsafe chars (default: '_') */
  replacement?: string;
  /** Whether to preserve the file extension (default: true) */
  preserveExtension?: boolean;
  /** Whether to log sanitization attempts (default: true) */
  logAttempts?: boolean;
}

/**
 * Sanitizes a filename to prevent path traversal and injection attacks.
 *
 * @param filename - The original filename (may contain malicious content)
 * @param options - Sanitization options
 * @returns Sanitized filename safe for filesystem operations
 *
 * @example
 * sanitizeFilename('../../../etc/passwd')  // Returns 'passwd'
 * sanitizeFilename('file<script>.txt')     // Returns 'file_script_.txt'
 */
export function sanitizeFilename(
  filename: string,
  options: SanitizeOptions = {},
): string {
  const {
    maxLength = MAX_FILENAME_LENGTH,
    replacement = "_",
    preserveExtension = true,
    logAttempts = true,
  } = options;

  // Step 1: Extract basename to remove any directory components
  // This prevents ../../../etc/passwd attacks
  let sanitized = path.basename(filename);

  // Log if the basename differs from original (traversal attempt)
  if (logAttempts && sanitized !== filename) {
    logger.warn(
      {
        original: filename,
        sanitized,
        reason: "path_traversal_blocked",
      },
      "Path traversal attempt blocked",
    );
  }

  // Step 2: Check for null bytes
  if (sanitized.includes("\0")) {
    if (logAttempts) {
      logger.warn(
        {
          original: filename,
          reason: "null_byte_injection",
        },
        "Null byte injection attempt blocked",
      );
    }
    sanitized = sanitized.replace(/\0/g, "");
  }

  // Step 3: Check for double-encoded sequences
  if (/%2e|%00|%2f|%5c/i.test(sanitized)) {
    if (logAttempts) {
      logger.warn(
        {
          original: filename,
          sanitized,
          reason: "url_encoded_traversal",
        },
        "URL-encoded traversal attempt blocked",
      );
    }
    // Decode and re-sanitize
    try {
      sanitized = decodeURIComponent(sanitized);
      sanitized = path.basename(sanitized);
    } catch {
      // If decode fails, strip the percent signs
      sanitized = sanitized.replace(/%/g, "");
    }
  }

  // Step 4: Extract extension if preserving
  let extension = "";
  if (preserveExtension) {
    const lastDot = sanitized.lastIndexOf(".");
    if (lastDot > 0) {
      extension = sanitized.slice(lastDot).toLowerCase();
      sanitized = sanitized.slice(0, lastDot);
    }
  }

  // Step 5: Replace unsafe characters with replacement char
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, replacement);

  // Step 6: Remove multiple consecutive replacement chars
  const escapedReplacement = replacement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  sanitized = sanitized.replace(
    new RegExp(`${escapedReplacement}+`, "g"),
    replacement,
  );

  // Step 7: Remove leading/trailing replacement chars and dots
  sanitized = sanitized.replace(/^[._-]+|[._-]+$/g, "");

  // Step 8: Check for Windows reserved names
  const baseName = sanitized.toUpperCase();
  if (WINDOWS_RESERVED.includes(baseName)) {
    sanitized = `_${sanitized}`;
    if (logAttempts) {
      logger.warn(
        {
          original: filename,
          reason: "windows_reserved_name",
        },
        "Windows reserved name sanitized",
      );
    }
  }

  // Step 9: Re-add extension
  if (preserveExtension && extension) {
    // Sanitize extension too
    extension = extension.replace(/[^a-zA-Z0-9.]/g, "");
    sanitized = sanitized + extension;
  }

  // Step 10: Ensure non-empty
  if (!sanitized || sanitized === ".") {
    sanitized = `file_${Date.now()}`;
  }

  // Step 11: Truncate to max length
  if (sanitized.length > maxLength) {
    if (extension) {
      const maxBase = maxLength - extension.length;
      sanitized = sanitized.slice(0, maxBase) + extension;
    } else {
      sanitized = sanitized.slice(0, maxLength);
    }
  }

  return sanitized;
}

// ============================================================================
// SAFE PATH JOIN
// ============================================================================

/**
 * Safely joins path segments and validates the result stays within a base directory.
 *
 * @param baseDir - The base directory that must contain the result
 * @param segments - Path segments to join
 * @returns Safe absolute path within baseDir
 * @throws Error if the result would escape baseDir
 *
 * @example
 * safeJoin('/uploads', 'user123', 'file.txt')  // '/uploads/user123/file.txt'
 * safeJoin('/uploads', '../etc/passwd')        // throws Error
 */
export function safeJoin(baseDir: string, ...segments: string[]): string {
  // Normalize and resolve the base directory
  const resolvedBase = path.resolve(baseDir);

  // Sanitize each segment
  const sanitizedSegments = segments.map((seg) => {
    // Check for traversal in segment
    if (containsTraversal(seg)) {
      logger.warn(
        {
          segment: seg,
          baseDir: resolvedBase,
        },
        "Path traversal blocked in safeJoin",
      );
      return sanitizeFilename(seg);
    }
    return seg;
  });

  // Join and resolve the full path
  const fullPath = path.resolve(resolvedBase, ...sanitizedSegments);

  // Verify the result is within the base directory
  if (
    !fullPath.startsWith(resolvedBase + path.sep) &&
    fullPath !== resolvedBase
  ) {
    logger.error(
      {
        baseDir: resolvedBase,
        segments,
        resolvedPath: fullPath,
      },
      "Path escape attempt blocked",
    );

    throw new Error(
      `Path escape attempt blocked: result "${fullPath}" is outside base "${resolvedBase}"`,
    );
  }

  return fullPath;
}

// ============================================================================
// PATH VALIDATION
// ============================================================================

/**
 * Validates that a path is safe for filesystem operations.
 *
 * @param inputPath - Path to validate
 * @param baseDir - Optional base directory the path must be within
 * @returns Validation result with details
 */
export function validatePath(
  inputPath: string,
  baseDir?: string,
): { valid: boolean; reason?: string; sanitized?: string } {
  // Check for traversal patterns
  if (containsTraversal(inputPath)) {
    return {
      valid: false,
      reason: "Contains path traversal sequences",
      sanitized: sanitizeFilename(inputPath),
    };
  }

  // Check for null bytes
  if (inputPath.includes("\0")) {
    return {
      valid: false,
      reason: "Contains null byte",
      sanitized: inputPath.replace(/\0/g, ""),
    };
  }

  // Check for dangerous system paths
  if (isDangerousPath(inputPath)) {
    return {
      valid: false,
      reason: "Attempts to access system directories",
    };
  }

  // If base directory provided, verify containment
  if (baseDir) {
    const resolvedBase = path.resolve(baseDir);
    const resolvedPath = path.resolve(baseDir, inputPath);

    if (!resolvedPath.startsWith(resolvedBase)) {
      return {
        valid: false,
        reason: "Path escapes base directory",
      };
    }
  }

  return { valid: true };
}

/**
 * Asserts that a path is valid, throwing if not.
 */
export function assertValidPath(inputPath: string, baseDir?: string): void {
  const result = validatePath(inputPath, baseDir);
  if (!result.valid) {
    throw new Error(`Invalid path "${inputPath}": ${result.reason}`);
  }
}

// ============================================================================
// ZIP SLIP PREVENTION
// ============================================================================

/**
 * Validates an archive entry path to prevent Zip Slip attacks.
 * Archive extractors must use this before writing extracted files.
 *
 * @param entryPath - Path from archive entry
 * @param extractDir - Directory where files will be extracted
 * @returns Safe absolute path for the entry
 * @throws Error if entry would escape extract directory
 */
export function safeArchiveEntryPath(
  entryPath: string,
  extractDir: string,
): string {
  // Normalize the entry path
  const normalizedEntry = path.normalize(entryPath);

  // Check for absolute paths in entry (should never happen in valid archives)
  if (path.isAbsolute(normalizedEntry)) {
    throw new Error(`Archive entry has absolute path: ${entryPath}`);
  }

  // Use safeJoin which will validate containment
  return safeJoin(extractDir, normalizedEntry);
}
