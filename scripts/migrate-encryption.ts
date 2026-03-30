#!/usr/bin/env ts-node
/**
 * Migration Script: Legacy Encryption to AES-256-GCM
 *
 * This script migrates data encrypted with the deprecated createCipher/createDecipher
 * methods to the new secure AES-256-GCM format with proper key derivation.
 *
 * Usage:
 *   npx ts-node scripts/migrate-encryption.ts --dry-run
 *   npx ts-node scripts/migrate-encryption.ts --execute
 *
 * Environment Variables:
 *   LEGACY_ENCRYPTION_KEY - The key used for legacy encryption
 *   NEW_ENCRYPTION_KEY - The new master key (can be same as legacy)
 *   DATABASE_URL - Prisma database connection string
 */

import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";
import {
  decrypt,
  isValidFormat,
  migrateLegacy,
} from "../apps/api/src/utils/encryption";

const prisma = new PrismaClient();

interface MigrationResult {
  table: string;
  field: string;
  recordId: string;
  status: "success" | "skipped" | "failed";
  error?: string;
}

interface MigrationConfig {
  table: string;
  idField: string;
  encryptedFields: string[];
}

// Configure which tables/fields contain encrypted data
const MIGRATION_CONFIG: MigrationConfig[] = [
  {
    table: "ApiKey",
    idField: "id",
    encryptedFields: ["keyHash"], // If storing encrypted API keys
  },
  {
    table: "User",
    idField: "id",
    encryptedFields: ["encryptedData"], // Any user encrypted fields
  },
  // Add more tables as needed
];

/**
 * Checks if data is in legacy hex format (not v1 versioned)
 */
function isLegacyFormat(data: string): boolean {
  if (!data) return false;
  // Legacy format is hex-encoded, new format starts with 'v1:'
  return /^[a-f0-9]+$/i.test(data) && !data.startsWith("v1:");
}

/**
 * Attempts to decrypt with legacy method to verify it's valid legacy data
 */
function canDecryptLegacy(encrypted: string, key: string): boolean {
  try {
    const decipher = crypto.createDecipher("aes-256-cbc", key);
    decipher.update(encrypted, "hex", "utf8");
    decipher.final("utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Migrates a single encrypted value
 */
function migrateValue(
  value: string,
  legacyKey: string,
  newKey: string,
  dryRun: boolean,
): {
  newValue: string | null;
  status: "success" | "skipped" | "failed";
  error?: string;
} {
  // Skip if already in v1 format
  if (isValidFormat(value)) {
    return { newValue: null, status: "skipped" };
  }

  // Skip if not legacy format
  if (!isLegacyFormat(value)) {
    return { newValue: null, status: "skipped" };
  }

  // Verify it's actually decryptable with legacy method
  if (!canDecryptLegacy(value, legacyKey)) {
    return {
      newValue: null,
      status: "failed",
      error: "Cannot decrypt with provided legacy key",
    };
  }

  if (dryRun) {
    return { newValue: null, status: "success" };
  }

  try {
    const migrated = migrateLegacy(value, legacyKey, newKey);
    return { newValue: migrated, status: "success" };
  } catch (error) {
    return {
      newValue: null,
      status: "failed",
      error: (error as Error).message,
    };
  }
}

/**
 * Main migration function
 */
async function runMigration(dryRun: boolean): Promise<void> {
  const legacyKey = process.env.LEGACY_ENCRYPTION_KEY;
  const newKey = process.env.NEW_ENCRYPTION_KEY;

  if (!legacyKey || !newKey) {
    console.error(
      "Error: LEGACY_ENCRYPTION_KEY and NEW_ENCRYPTION_KEY environment variables are required",
    );
    process.exit(1);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Encryption Migration Script`);
  console.log(
    `  Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "EXECUTE"}`,
  );
  console.log(`${"=".repeat(60)}\n`);

  const results: MigrationResult[] = [];
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const config of MIGRATION_CONFIG) {
    console.log(`\nProcessing table: ${config.table}`);
    console.log("-".repeat(40));

    try {
      // Dynamically access Prisma model
      const model = (prisma as any)[
        config.table.charAt(0).toLowerCase() + config.table.slice(1)
      ];

      if (!model) {
        console.log(
          `  ⚠️  Table ${config.table} not found in Prisma schema, skipping...`,
        );
        continue;
      }

      const records = await model.findMany({
        select: {
          [config.idField]: true,
          ...Object.fromEntries(config.encryptedFields.map((f) => [f, true])),
        },
      });

      console.log(`  Found ${records.length} records`);

      for (const record of records) {
        const recordId = record[config.idField];

        for (const field of config.encryptedFields) {
          const value = record[field];

          if (!value) {
            continue;
          }

          const { newValue, status, error } = migrateValue(
            value,
            legacyKey,
            newKey,
            dryRun,
          );

          results.push({
            table: config.table,
            field,
            recordId: String(recordId),
            status,
            error,
          });

          if (status === "success") {
            successCount++;
            if (!dryRun && newValue) {
              await model.update({
                where: { [config.idField]: recordId },
                data: { [field]: newValue },
              });
              console.log(
                `  ✅ Migrated ${config.table}.${field} (id: ${recordId})`,
              );
            } else if (dryRun) {
              console.log(
                `  🔍 Would migrate ${config.table}.${field} (id: ${recordId})`,
              );
            }
          } else if (status === "skipped") {
            skipCount++;
            console.log(
              `  ⏭️  Skipped ${config.table}.${field} (id: ${recordId}) - already migrated or not encrypted`,
            );
          } else {
            failCount++;
            console.log(
              `  ❌ Failed ${config.table}.${field} (id: ${recordId}): ${error}`,
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `  Error processing table ${config.table}: ${(error as Error).message}`,
      );
    }
  }

  // Print summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("  Migration Summary");
  console.log(`${"=".repeat(60)}`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ⏭️  Skipped: ${skipCount}`);
  console.log(`  ❌ Failed:  ${failCount}`);
  console.log(`  📊 Total:   ${results.length}`);

  if (dryRun && successCount > 0) {
    console.log(`\n  Run with --execute to apply changes`);
  }

  console.log("");
}

/**
 * Verify migration by testing decrypt on migrated data
 */
async function verifyMigration(): Promise<void> {
  const newKey = process.env.NEW_ENCRYPTION_KEY;

  if (!newKey) {
    console.error("Error: NEW_ENCRYPTION_KEY environment variable is required");
    process.exit(1);
  }

  console.log("\nVerifying migrated data...\n");

  let verified = 0;
  let failed = 0;

  for (const config of MIGRATION_CONFIG) {
    try {
      const model = (prisma as any)[
        config.table.charAt(0).toLowerCase() + config.table.slice(1)
      ];

      if (!model) continue;

      const records = await model.findMany({
        select: {
          [config.idField]: true,
          ...Object.fromEntries(config.encryptedFields.map((f) => [f, true])),
        },
      });

      for (const record of records) {
        for (const field of config.encryptedFields) {
          const value = record[field];

          if (!value || !isValidFormat(value)) continue;

          try {
            decrypt(value, newKey);
            verified++;
            console.log(
              `  ✅ Verified ${config.table}.${field} (id: ${record[config.idField]})`,
            );
          } catch (error) {
            failed++;
            console.log(
              `  ❌ Failed to verify ${config.table}.${field} (id: ${record[config.idField]})`,
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `  Error verifying table ${config.table}: ${(error as Error).message}`,
      );
    }
  }

  console.log(
    `\nVerification complete: ${verified} verified, ${failed} failed`,
  );
}

// CLI handling
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Encryption Migration Script

Usage:
  npx ts-node scripts/migrate-encryption.ts [options]

Options:
  --dry-run     Preview changes without applying them (default)
  --execute     Apply the migration
  --verify      Verify migrated data can be decrypted
  --help, -h    Show this help message

Environment Variables:
  LEGACY_ENCRYPTION_KEY  The key used for legacy encryption
  NEW_ENCRYPTION_KEY     The new master key
  DATABASE_URL           Prisma database connection string
`);
    process.exit(0);
  }

  try {
    if (args.includes("--verify")) {
      await verifyMigration();
    } else {
      const dryRun = !args.includes("--execute");
      await runMigration(dryRun);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
