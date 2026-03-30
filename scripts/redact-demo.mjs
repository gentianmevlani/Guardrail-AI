#!/usr/bin/env node
/**
 * Redact Demo - Remove sensitive data from demo artifacts
 * 
 * Redacts:
 * - API keys, tokens, secrets
 * - Email addresses
 * - IP addresses
 * - File paths containing usernames
 * - URLs with credentials
 * - Any pattern matching common secrets
 * 
 * Usage: node scripts/redact-demo.mjs <demo-directory>
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
  STRIPE_LIVE_PREFIX,
  STRIPE_PK_LIVE_PREFIX,
  STRIPE_PK_TEST_PREFIX,
  STRIPE_TEST_PREFIX,
  stripePkLiveRegex24,
  stripeSkLiveRegex24,
  stripeSkTestRegex24,
} = require('../bin/runners/lib/stripe-scan-patterns.js');

// Patterns to redact
const REDACTION_PATTERNS = [
  // API Keys
  { pattern: stripeSkTestRegex24(), replacement: `${STRIPE_TEST_PREFIX}[REDACTED]` },
  { pattern: stripeSkLiveRegex24(), replacement: `${STRIPE_LIVE_PREFIX}[REDACTED]` },
  { pattern: new RegExp(STRIPE_PK_TEST_PREFIX + '[a-zA-Z0-9]{24,}', 'g'), replacement: `${STRIPE_PK_TEST_PREFIX}[REDACTED]` },
  { pattern: stripePkLiveRegex24(), replacement: `${STRIPE_PK_LIVE_PREFIX}[REDACTED]` },
  { pattern: /api[_-]?key["\s:=]+["']?[a-zA-Z0-9_-]{16,}["']?/gi, replacement: 'api_key="[REDACTED]"' },
  { pattern: /secret["\s:=]+["']?[a-zA-Z0-9_-]{16,}["']?/gi, replacement: 'secret="[REDACTED]"' },
  { pattern: /token["\s:=]+["']?[a-zA-Z0-9_.-]{20,}["']?/gi, replacement: 'token="[REDACTED]"' },
  
  // Emails
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: 'user@example.com' },
  
  // IP addresses (but not localhost)
  { pattern: /\b(?!127\.0\.0\.1)(?!0\.0\.0\.0)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP_REDACTED]' },
  
  // File paths with usernames (Windows)
  { pattern: /C:\\Users\\[^\\]+\\/gi, replacement: 'C:\\Users\\[USER]\\' },
  { pattern: /\/Users\/[^\/]+\//gi, replacement: '/Users/[USER]/' },
  { pattern: /\/home\/[^\/]+\//gi, replacement: '/home/[USER]/' },
  
  // URLs with credentials
  { pattern: /:\/\/[^:]+:[^@]+@/g, replacement: '://[REDACTED]@' },
  
  // Database URLs
  { pattern: /postgres(ql)?:\/\/[^@]+@[^\s"]+/gi, replacement: 'postgresql://[REDACTED]@[REDACTED]' },
  { pattern: /mysql:\/\/[^@]+@[^\s"]+/gi, replacement: 'mysql://[REDACTED]@[REDACTED]' },
  { pattern: /mongodb(\+srv)?:\/\/[^@]+@[^\s"]+/gi, replacement: 'mongodb://[REDACTED]@[REDACTED]' },
  
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: 'AKIA[REDACTED]' },
  { pattern: /aws[_-]?secret[_-]?access[_-]?key["\s:=]+["']?[a-zA-Z0-9\/+=]{40}["']?/gi, replacement: 'aws_secret_access_key="[REDACTED]"' },
  
  // GitHub tokens
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: 'ghp_[REDACTED]' },
  { pattern: /gho_[a-zA-Z0-9]{36}/g, replacement: 'gho_[REDACTED]' },
  { pattern: /github_pat_[a-zA-Z0-9_]{22,}/g, replacement: 'github_pat_[REDACTED]' },
  
  // JWT tokens (but keep structure visible)
  { pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, replacement: 'eyJ[HEADER].eyJ[PAYLOAD].[SIGNATURE]' },
  
  // Private keys
  { pattern: /-----BEGIN [A-Z ]+ KEY-----[\s\S]*?-----END [A-Z ]+ KEY-----/g, replacement: '-----BEGIN PRIVATE KEY-----\n[REDACTED]\n-----END PRIVATE KEY-----' },
];

// Paths to always redact completely
const SENSITIVE_FILE_PATTERNS = [
  /\.env$/,
  /\.env\.(local|production|development)$/,
  /secrets?\.(json|yaml|yml)$/,
  /credentials?\.(json|yaml|yml)$/,
];

/**
 * Redact sensitive data from a string
 */
function redactString(content) {
  let result = content;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Process a JSON file - redact values but preserve structure
 */
async function processJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const redacted = redactString(content);
    await fs.writeFile(filePath, redacted);
    console.log(`✓ Redacted: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to process ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Process a text file
 */
async function processTextFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const redacted = redactString(content);
    await fs.writeFile(filePath, redacted);
    console.log(`✓ Redacted: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to process ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Check if a file should be completely removed
 */
function shouldRemoveFile(filePath) {
  const basename = path.basename(filePath);
  return SENSITIVE_FILE_PATTERNS.some(pattern => pattern.test(basename));
}

/**
 * Process all files in a directory
 */
async function processDirectory(dirPath) {
  console.log(`\n📁 Processing: ${dirPath}\n`);
  
  let processed = 0;
  let removed = 0;
  let skipped = 0;
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively process subdirectories
        const subStats = await processDirectory(fullPath);
        processed += subStats.processed;
        removed += subStats.removed;
        skipped += subStats.skipped;
        continue;
      }
      
      if (!entry.isFile()) continue;
      
      // Check if file should be removed entirely
      if (shouldRemoveFile(fullPath)) {
        await fs.unlink(fullPath);
        console.log(`🗑️  Removed: ${entry.name}`);
        removed++;
        continue;
      }
      
      const ext = path.extname(entry.name).toLowerCase();
      
      // Process based on file type
      if (ext === '.json') {
        await processJsonFile(fullPath);
        processed++;
      } else if (['.txt', '.log', '.md', '.html'].includes(ext)) {
        await processTextFile(fullPath);
        processed++;
      } else if (['.webm', '.mp4', '.png', '.jpg', '.zip'].includes(ext)) {
        // Binary files - skip redaction but keep
        console.log(`⏭️  Skipped (binary): ${entry.name}`);
        skipped++;
      } else {
        // Unknown file type - try to redact as text
        try {
          await processTextFile(fullPath);
          processed++;
        } catch {
          skipped++;
        }
      }
    }
  } catch (error) {
    console.error(`Error processing directory: ${error.message}`);
  }
  
  return { processed, removed, skipped };
}

/**
 * Create sanitized replay.json from replay-raw.json
 */
async function createSanitizedReplay(dirPath) {
  const rawPath = path.join(dirPath, 'replay-raw.json');
  const sanitizedPath = path.join(dirPath, 'replay.json');
  
  try {
    if (await fs.access(rawPath).then(() => true).catch(() => false)) {
      const raw = JSON.parse(await fs.readFile(rawPath, 'utf-8'));
      
      // Sanitize the replay data
      const sanitized = sanitizeReplay(raw);
      
      await fs.writeFile(sanitizedPath, JSON.stringify(sanitized, null, 2));
      await fs.unlink(rawPath);
      
      console.log(`✓ Created sanitized replay.json`);
    }
  } catch (error) {
    console.error(`Failed to sanitize replay: ${error.message}`);
  }
}

/**
 * Sanitize replay data structure
 */
function sanitizeReplay(replay) {
  if (Array.isArray(replay)) {
    return replay.map(sanitizeReplay);
  }
  
  if (typeof replay !== 'object' || replay === null) {
    if (typeof replay === 'string') {
      return redactString(replay);
    }
    return replay;
  }
  
  const result = {};
  for (const [key, value] of Object.entries(replay)) {
    // Skip certain sensitive keys entirely
    if (['password', 'secret', 'token', 'apiKey', 'authorization'].includes(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (key === 'headers') {
      // Redact sensitive headers
      result[key] = sanitizeHeaders(value);
    } else if (key === 'body' && typeof value === 'string') {
      // Redact body content
      result[key] = redactString(value);
    } else {
      result[key] = sanitizeReplay(value);
    }
  }
  
  return result;
}

/**
 * Sanitize HTTP headers
 */
function sanitizeHeaders(headers) {
  if (typeof headers !== 'object' || headers === null) return headers;
  
  const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token'];
  const result = {};
  
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node scripts/redact-demo.mjs <demo-directory>');
    process.exit(1);
  }
  
  const targetDir = path.resolve(args[0]);
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🔒 GUARDRAIL Demo Redaction Tool 🔒               ║
╚══════════════════════════════════════════════════════════════╝
`);
  
  console.log(`Target: ${targetDir}`);
  
  // Check if directory exists
  try {
    await fs.access(targetDir);
  } catch {
    console.error(`Directory not found: ${targetDir}`);
    process.exit(1);
  }
  
  // Process all files
  const stats = await processDirectory(targetDir);
  
  // Create sanitized replay
  await createSanitizedReplay(targetDir);
  
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    ✅ Redaction Complete ✅                  ║
╚══════════════════════════════════════════════════════════════╝
`);
  
  console.log(`Processed: ${stats.processed} files`);
  console.log(`Removed:   ${stats.removed} sensitive files`);
  console.log(`Skipped:   ${stats.skipped} binary files`);
}

main().catch(console.error);
