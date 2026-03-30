/**
 * Unit Tests for Secure Encryption Utility
 */

import * as crypto from "crypto";
import {
  decrypt,
  encrypt,
  ENCRYPTION_CONSTANTS,
  generateKey,
  isValidFormat,
  migrateLegacy,
  rotateKey,
} from "./encryption";

describe("Encryption Utility", () => {
  const validMasterKey = "test-master-key-at-least-16-chars";
  const shortKey = "short";

  describe("encrypt", () => {
    it("should encrypt plaintext and return versioned format", () => {
      const plaintext = "Hello, World!";
      const encrypted = encrypt(plaintext, validMasterKey);

      expect(encrypted).toMatch(/^v1:/);
      expect(encrypted.split(":").length).toBe(5);
    });

    it("should produce different ciphertexts for same input (IV uniqueness)", () => {
      const plaintext = "Same plaintext";
      const encrypted1 = encrypt(plaintext, validMasterKey);
      const encrypted2 = encrypt(plaintext, validMasterKey);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should throw error for empty plaintext", () => {
      expect(() => encrypt("", validMasterKey)).toThrow(
        "Plaintext cannot be empty",
      );
    });

    it("should throw error for short master key", () => {
      expect(() => encrypt("test", shortKey)).toThrow(
        "Master key must be at least 16 characters",
      );
    });

    it("should handle unicode characters", () => {
      const unicodeText = "你好世界 🌍 مرحبا";
      const encrypted = encrypt(unicodeText, validMasterKey);
      const decrypted = decrypt(encrypted, validMasterKey);

      expect(decrypted).toBe(unicodeText);
    });

    it("should handle large plaintext", () => {
      const largePlaintext = "x".repeat(100000);
      const encrypted = encrypt(largePlaintext, validMasterKey);
      const decrypted = decrypt(encrypted, validMasterKey);

      expect(decrypted).toBe(largePlaintext);
    });
  });

  describe("decrypt", () => {
    it("should decrypt encrypted data correctly (round-trip)", () => {
      const plaintext = "Secret message";
      const encrypted = encrypt(plaintext, validMasterKey);
      const decrypted = decrypt(encrypted, validMasterKey);

      expect(decrypted).toBe(plaintext);
    });

    it("should throw error for empty encrypted data", () => {
      expect(() => decrypt("", validMasterKey)).toThrow(
        "Encrypted data cannot be empty",
      );
    });

    it("should throw error for invalid master key", () => {
      expect(() => decrypt("v1:test:test:test:test", shortKey)).toThrow(
        "Master key must be at least 16 characters",
      );
    });

    it("should throw error for invalid format", () => {
      expect(() => decrypt("invalid-format", validMasterKey)).toThrow();
    });

    it("should throw error for unsupported version", () => {
      expect(() => decrypt("v99:a:b:c:d", validMasterKey)).toThrow(
        "Unsupported encryption version",
      );
    });

    it("should throw error for wrong key", () => {
      const encrypted = encrypt("test", validMasterKey);
      const wrongKey = "wrong-master-key-also-16-chars";

      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });
  });

  describe("tamper detection (auth tag validation)", () => {
    it("should detect tampered ciphertext", () => {
      const encrypted = encrypt("Secret data", validMasterKey);
      const parts = encrypted.split(":");

      // Tamper with ciphertext (last part)
      const tamperedCiphertext = Buffer.from(parts[4], "base64");
      tamperedCiphertext[0] ^= 0xff; // Flip bits
      parts[4] = tamperedCiphertext.toString("base64");

      const tampered = parts.join(":");

      expect(() => decrypt(tampered, validMasterKey)).toThrow();
    });

    it("should detect tampered auth tag", () => {
      const encrypted = encrypt("Secret data", validMasterKey);
      const parts = encrypted.split(":");

      // Tamper with auth tag (4th part)
      const tamperedAuthTag = Buffer.from(parts[3], "base64");
      tamperedAuthTag[0] ^= 0xff;
      parts[3] = tamperedAuthTag.toString("base64");

      const tampered = parts.join(":");

      expect(() => decrypt(tampered, validMasterKey)).toThrow();
    });

    it("should detect tampered IV", () => {
      const encrypted = encrypt("Secret data", validMasterKey);
      const parts = encrypted.split(":");

      // Tamper with IV (3rd part)
      const tamperedIv = Buffer.from(parts[2], "base64");
      tamperedIv[0] ^= 0xff;
      parts[2] = tamperedIv.toString("base64");

      const tampered = parts.join(":");

      expect(() => decrypt(tampered, validMasterKey)).toThrow();
    });

    it("should detect tampered salt", () => {
      const encrypted = encrypt("Secret data", validMasterKey);
      const parts = encrypted.split(":");

      // Tamper with salt (2nd part)
      const tamperedSalt = Buffer.from(parts[1], "base64");
      tamperedSalt[0] ^= 0xff;
      parts[1] = tamperedSalt.toString("base64");

      const tampered = parts.join(":");

      expect(() => decrypt(tampered, validMasterKey)).toThrow();
    });
  });

  describe("rotateKey", () => {
    it("should re-encrypt data with new key", () => {
      const plaintext = "Sensitive information";
      const oldKey = "old-master-key-16-chars";
      const newKey = "new-master-key-16-chars";

      const encryptedWithOld = encrypt(plaintext, oldKey);
      const encryptedWithNew = rotateKey(encryptedWithOld, oldKey, newKey);

      // Should not be able to decrypt with old key
      expect(() => decrypt(encryptedWithNew, oldKey)).toThrow();

      // Should be able to decrypt with new key
      const decrypted = decrypt(encryptedWithNew, newKey);
      expect(decrypted).toBe(plaintext);
    });

    it("should throw error if old key is wrong", () => {
      const encrypted = encrypt("test", validMasterKey);
      const wrongKey = "wrong-key-16-characters";
      const newKey = "new-key-16-characters!";

      expect(() => rotateKey(encrypted, wrongKey, newKey)).toThrow();
    });
  });

  describe("migrateLegacy", () => {
    it("should migrate legacy hex-encoded data to v1 format", () => {
      // Create legacy encrypted data using deprecated method
      const plaintext = "Legacy secret data";
      const legacyKey = "legacy-key-string";

      // Encrypt using deprecated method (simulating legacy data)
      const legacyCipher = crypto.createCipher("aes-256-cbc", legacyKey);
      let legacyEncrypted = legacyCipher.update(plaintext, "utf8", "hex");
      legacyEncrypted += legacyCipher.final("hex");

      // Migrate to new format
      const newKey = "new-secure-key-16-chars";
      const migrated = migrateLegacy(legacyEncrypted, legacyKey, newKey);

      // Verify it's in v1 format
      expect(migrated).toMatch(/^v1:/);
      expect(isValidFormat(migrated)).toBe(true);

      // Verify content is preserved
      const decrypted = decrypt(migrated, newKey);
      expect(decrypted).toBe(plaintext);
    });

    it("should throw error for invalid legacy data", () => {
      expect(() =>
        migrateLegacy(
          "not-valid-hex",
          "key-16-characters",
          "new-16-characters",
        ),
      ).toThrow();
    });
  });

  describe("generateKey", () => {
    it("should generate a random base64 key", () => {
      const key = generateKey();

      // 32 bytes = 44 base64 chars (with padding)
      expect(key.length).toBeGreaterThanOrEqual(43);
      expect(() => Buffer.from(key, "base64")).not.toThrow();
    });

    it("should generate keys of specified length", () => {
      const key16 = generateKey(16);
      const key64 = generateKey(64);

      const decoded16 = Buffer.from(key16, "base64");
      const decoded64 = Buffer.from(key64, "base64");

      expect(decoded16.length).toBe(16);
      expect(decoded64.length).toBe(64);
    });

    it("should generate unique keys each time", () => {
      const key1 = generateKey();
      const key2 = generateKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe("isValidFormat", () => {
    it("should return true for valid v1 format", () => {
      const encrypted = encrypt("test", validMasterKey);
      expect(isValidFormat(encrypted)).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(isValidFormat("")).toBe(false);
    });

    it("should return false for invalid format", () => {
      expect(isValidFormat("not:valid:format")).toBe(false);
      expect(isValidFormat("v1:a:b:c")).toBe(false); // Missing part
      expect(isValidFormat("v2:a:b:c:d")).toBe(false); // Wrong version
    });

    it("should return false for invalid component lengths", () => {
      // Invalid salt length
      expect(isValidFormat("v1:YQ==:YQ==:YQ==:YQ==")).toBe(false);
    });
  });

  describe("ENCRYPTION_CONSTANTS", () => {
    it("should export correct algorithm", () => {
      expect(ENCRYPTION_CONSTANTS.ALGORITHM).toBe("aes-256-gcm");
    });

    it("should export correct key length", () => {
      expect(ENCRYPTION_CONSTANTS.KEY_LENGTH).toBe(32);
    });

    it("should export correct IV length", () => {
      expect(ENCRYPTION_CONSTANTS.IV_LENGTH).toBe(12);
    });

    it("should export current version", () => {
      expect(ENCRYPTION_CONSTANTS.CURRENT_VERSION).toBe("v1");
    });
  });

  describe("edge cases", () => {
    it("should handle special characters in plaintext", () => {
      const special = "!@#$%^&*()_+-=[]{}|;:'\",.<>?/\\`~\n\t\r";
      const encrypted = encrypt(special, validMasterKey);
      const decrypted = decrypt(encrypted, validMasterKey);

      expect(decrypted).toBe(special);
    });

    it("should handle empty JSON objects", () => {
      const json = JSON.stringify({});
      const encrypted = encrypt(json, validMasterKey);
      const decrypted = decrypt(encrypted, validMasterKey);

      expect(JSON.parse(decrypted)).toEqual({});
    });

    it("should handle complex JSON structures", () => {
      const complex = {
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
        config: { nested: { deep: { value: true } } },
        nullValue: null,
        numbers: [1, 2.5, -3, 0],
      };
      const json = JSON.stringify(complex);
      const encrypted = encrypt(json, validMasterKey);
      const decrypted = decrypt(encrypted, validMasterKey);

      expect(JSON.parse(decrypted)).toEqual(complex);
    });

    it("should handle keys with special characters", () => {
      const specialKey = "key!@#$%^&*()_+-=16";
      const plaintext = "test data";
      const encrypted = encrypt(plaintext, specialKey);
      const decrypted = decrypt(encrypted, specialKey);

      expect(decrypted).toBe(plaintext);
    });
  });
});
