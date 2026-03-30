/**
 * Audit Bridge for MCP Server
 * 
 * ES Module wrapper for audit trail functionality in MCP context.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { stripeAnyKeyPrefixRegex } = require('../bin/runners/lib/stripe-scan-patterns.js');

const AUDIT_DIR = ".guardrail/audit";
const AUDIT_FILE = "audit.log.jsonl";
const GENESIS_HASH = "0".repeat(64);

function getCurrentTier() {
  return process.env.GUARDRAIL_TIER || "free";
}

function getCurrentActor() {
  const env = process.env;
  const userId = env.GUARDRAIL_USER_ID || env.USER || env.USERNAME || "mcp-client";
  const userName = env.GUARDRAIL_USER_NAME || env.USERNAME;
  
  return {
    id: userId,
    type: "system",
    name: userName || "MCP Client",
  };
}

const REDACTION_PATTERNS = [
  /(?:api[_-]?key|apikey|token|secret|password|pwd|auth)[=:]\s*['"]?([a-zA-Z0-9_\-]{16,})['"]?/gi,
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,
  stripeAnyKeyPrefixRegex(),
];

function redactSensitive(input) {
  if (typeof input !== "string") return input;
  let result = input;
  for (const pattern of REDACTION_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

function redactMetadata(metadata, tier) {
  if (!metadata) return undefined;
  
  if (["compliance", "enterprise", "unlimited"].includes(tier)) {
    return redactObject(metadata);
  }
  
  if (tier === "pro") {
    return {
      command: metadata.command,
      score: metadata.score,
      durationMs: metadata.durationMs,
      errorCode: metadata.errorCode,
    };
  }
  
  return { score: metadata.score };
}

function redactObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = redactSensitive(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) => (typeof v === "string" ? redactSensitive(v) : v));
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function computeHash(event) {
  const payload = JSON.stringify({
    id: event.id,
    timestamp: event.timestamp,
    actor: event.actor,
    surface: event.surface,
    action: event.action,
    category: event.category,
    target: event.target,
    tier: event.tier,
    result: event.result,
    metadata: event.metadata,
    prevHash: event.prevHash,
    version: event.version,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function getAuditFilePath(basePath = process.cwd()) {
  return path.join(basePath, AUDIT_DIR, AUDIT_FILE);
}

function ensureAuditDir(basePath = process.cwd()) {
  const dir = path.join(basePath, AUDIT_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getLastHash(basePath = process.cwd()) {
  const filePath = getAuditFilePath(basePath);
  if (!fs.existsSync(filePath)) {
    return GENESIS_HASH;
  }
  
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    return GENESIS_HASH;
  }
  
  try {
    const lastEvent = JSON.parse(lines[lines.length - 1]);
    return lastEvent.hash || GENESIS_HASH;
  } catch {
    return GENESIS_HASH;
  }
}

function createEvent(input, prevHash) {
  const tier = getCurrentTier();
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  const eventWithoutHash = {
    id,
    timestamp,
    actor: input.actor || getCurrentActor(),
    surface: input.surface,
    action: input.action,
    category: input.category,
    target: input.target,
    tier,
    result: input.result,
    metadata: redactMetadata(input.metadata, tier),
    prevHash,
    version: 1,
  };
  
  const hash = computeHash(eventWithoutHash);
  
  return {
    ...eventWithoutHash,
    hash,
  };
}

export function emit(input, basePath = process.cwd()) {
  try {
    ensureAuditDir(basePath);
    const prevHash = getLastHash(basePath);
    const event = createEvent(input, prevHash);
    
    const filePath = getAuditFilePath(basePath);
    fs.appendFileSync(filePath, JSON.stringify(event) + "\n", "utf8");
    
    return event;
  } catch (err) {
    if (process.env.GUARDRAIL_DEBUG) {
      console.error("[audit] Failed to emit event:", err.message);
    }
    return null;
  }
}

export function emitToolInvoke(toolName, args, result, metadata = {}) {
  return emit({
    surface: "mcp",
    action: "tool.invoke",
    category: "tool",
    target: { type: "tool", name: toolName },
    result,
    metadata: { command: toolName, args: JSON.stringify(args), ...metadata },
  });
}

export function emitToolComplete(toolName, result, metadata = {}) {
  return emit({
    surface: "mcp",
    action: "tool.complete",
    category: "tool",
    target: { type: "tool", name: toolName },
    result,
    metadata: { command: toolName, ...metadata },
  });
}

export const auditMcp = {
  emit,
  emitToolInvoke,
  emitToolComplete,
};

export default auditMcp;
