/**
 * Secure Encryption Utility Module
 *
 * Uses AES-256-GCM authenticated encryption with:
 * - scrypt for key derivation
 * - Random 12-byte IV per encryption
 * - Authentication tag for tamper detection
 * - Versioned format for future algorithm changes
 *
 * Format: v1:salt:iv:authTag:ciphertext (all base64 encoded)
 */

import * as crypto from "crypto";

// Constants
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits (recommended for GCM)
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const SCRYPT_COST = 16384; // N parameter
const SCRYPT_BLOCK_SIZE = 8; // r parameter
const SCRYPT_PARALLELIZATION = 1; // p parameter
const CURRENT_VERSION = "v1";

// Legacy format detection (for migration)
const LEGACY_PATTERNS = {
  v0_hex: /^[a-f0-9]+$/i, // Old hex-encoded format without version
};

export interface EncryptionResult {
  encrypted: string;
  version: string;
}

export interface DecryptionError extends Error {
  code:
    | "INVALID_FORMAT"
    | "INVALID_VERSION"
    | "DECRYPTION_FAILED"
    | "AUTH_FAILED"
    | "INVALID_KEY";
}

/**
 * Derives a cryptographic key from a master key using scrypt
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.scryptSync(masterKey, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
  });
}

/**
 * Creates a custom error with a specific code
 */
function createError(
  message: string,
  code: DecryptionError["code"],
): DecryptionError {
  const error = new Error(message) as DecryptionError;
  error.code = code;
  return error;
}

/**
 * Encrypts plaintext using AES-256-GCM with authenticated encryption
 *
 * @param plaintext - The text to encrypt
 * @param masterKey - The master encryption key
 * @returns Versioned encrypted string in format: v1:salt:iv:authTag:ciphertext
 * @throws Error if encryption fails
 */
export function encrypt(plaintext: string, masterKey: string): string {
  if (!plaintext) {
    throw createError("Plaintext cannot be empty", "INVALID_FORMAT");
  }
  if (!masterKey || masterKey.length < 16) {
    throw createError(
      "Master key must be at least 16 characters",
      "INVALID_KEY",
    );
  }

  try {
    // Generate random salt and IV for each encryption
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from master key using scrypt
    const key = deriveKey(masterKey, salt);

    // Create cipher with AES-256-GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Encrypt the plaintext
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine all components: version:salt:iv:authTag:ciphertext
    const components = [
      CURRENT_VERSION,
      salt.toString("base64"),
      iv.toString("base64"),
      authTag.toString("base64"),
      encrypted.toString("base64"),
    ];

    return components.join(":");
  } catch (error) {
    if ((error as DecryptionError).code) {
      throw error;
    }
    throw createError(
      `Encryption failed: ${(error as Error).message}`,
      "DECRYPTION_FAILED",
    );
  }
}

/**
 * Decrypts an encrypted string using AES-256-GCM
 *
 * @param encrypted - The encrypted string (versioned format)
 * @param masterKey - The master encryption key
 * @returns The decrypted plaintext
 * @throws DecryptionError if decryption fails
 */
export function decrypt(encrypted: string, masterKey: string): string {
  if (!encrypted) {
    throw createError("Encrypted data cannot be empty", "INVALID_FORMAT");
  }
  if (!masterKey || masterKey.length < 16) {
    throw createError(
      "Master key must be at least 16 characters",
      "INVALID_KEY",
    );
  }

  try {
    const parts = encrypted.split(":");

    // Check for versioned format
    if (parts[0] === "v1") {
      return decryptV1(parts, masterKey);
    }

    // Check for legacy format (migration support)
    if (isLegacyFormat(encrypted)) {
      throw createError(
        "Legacy encrypted data detected. Please run migration script.",
        "INVALID_VERSION",
      );
    }

    throw createError(
      `Unsupported encryption version: ${parts[0]}`,
      "INVALID_VERSION",
    );
  } catch (error) {
    if ((error as DecryptionError).code) {
      throw error;
    }
    throw createError(
      `Decryption failed: ${(error as Error).message}`,
      "DECRYPTION_FAILED",
    );
  }
}

/**
 * Decrypts v1 format: v1:salt:iv:authTag:ciphertext
 */
function decryptV1(parts: string[], masterKey: string): string {
  if (parts.length !== 5) {
    throw createError(
      "Invalid v1 format. Expected: v1:salt:iv:authTag:ciphertext",
      "INVALID_FORMAT",
    );
  }

  const [, saltB64, ivB64, authTagB64, ciphertextB64] = parts;

  // Decode all components from base64
  const salt = Buffer.from(saltB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  // Validate component lengths
  if (salt.length !== SALT_LENGTH) {
    throw createError(`Invalid salt length: ${salt.length}`, "INVALID_FORMAT");
  }
  if (iv.length !== IV_LENGTH) {
    throw createError(`Invalid IV length: ${iv.length}`, "INVALID_FORMAT");
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw createError(
      `Invalid auth tag length: ${authTag.length}`,
      "INVALID_FORMAT",
    );
  }

  // Derive key from master key
  const key = deriveKey(masterKey, salt);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Set auth tag for verification
  decipher.setAuthTag(authTag);

  try {
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    // GCM authentication failure
    if ((error as Error).message.includes("auth")) {
      throw createError(
        "Authentication failed - data may have been tampered with",
        "AUTH_FAILED",
      );
    }
    throw error;
  }
}

/**
 * Checks if the encrypted data is in a legacy format
 */
function isLegacyFormat(encrypted: string): boolean {
  return LEGACY_PATTERNS.v0_hex.test(encrypted);
}

/**
 * Re-encrypts data with a new key (for key rotation)
 *
 * @param encrypted - The currently encrypted string
 * @param oldKey - The current master key
 * @param newKey - The new master key
 * @returns The data encrypted with the new key
 */
export function rotateKey(
  encrypted: string,
  oldKey: string,
  newKey: string,
): string {
  // Decrypt with old key
  const plaintext = decrypt(encrypted, oldKey);

  // Re-encrypt with new key
  return encrypt(plaintext, newKey);
}

/**
 * Migrates legacy encrypted data to the new v1 format
 *
 * @param legacyEncrypted - Legacy hex-encoded encrypted data
 * @param legacyKey - The key used for legacy encryption
 * @param newKey - The new master key (can be same as legacyKey)
 * @returns The data in new v1 format
 */
export function migrateLegacy(
  legacyEncrypted: string,
  legacyKey: string,
  newKey: string,
): string {
  // Decrypt using legacy method (createDecipher)
  // Note: This uses the deprecated API intentionally for migration only
  const decipher = crypto.createDecipher("aes-256-cbc", legacyKey);

  let decrypted: string;
  try {
    decrypted = decipher.update(legacyEncrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
  } catch (error) {
    throw createError(
      `Legacy decryption failed: ${(error as Error).message}`,
      "DECRYPTION_FAILED",
    );
  }

  // Re-encrypt with new secure method
  return encrypt(decrypted, newKey);
}

/**
 * Generates a secure random key suitable for encryption
 *
 * @param length - Key length in bytes (default: 32)
 * @returns Base64-encoded random key
 */
export function generateKey(length: number = 32): string {
  return crypto.randomBytes(length).toString("base64");
}

/**
 * Validates that a string is properly encrypted in v1 format
 *
 * @param encrypted - The string to validate
 * @returns true if valid v1 format
 */
export function isValidFormat(encrypted: string): boolean {
  if (!encrypted) return false;

  const parts = encrypted.split(":");
  if (parts.length !== 5 || parts[0] !== "v1") return false;

  try {
    const salt = Buffer.from(parts[1], "base64");
    const iv = Buffer.from(parts[2], "base64");
    const authTag = Buffer.from(parts[3], "base64");

    return (
      salt.length === SALT_LENGTH &&
      iv.length === IV_LENGTH &&
      authTag.length === AUTH_TAG_LENGTH
    );
  } catch {
    return false;
  }
}

// Export constants for testing
export const ENCRYPTION_CONSTANTS = {
  ALGORITHM,
  KEY_LENGTH,
  IV_LENGTH,
  SALT_LENGTH,
  AUTH_TAG_LENGTH,
  CURRENT_VERSION,
};
