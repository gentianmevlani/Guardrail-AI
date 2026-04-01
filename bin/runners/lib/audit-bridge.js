/**
 * Audit Bridge - CLI Integration
 * 
 * Provides a CommonJS wrapper for the audit trail functionality.
 * Used by CLI runners to emit audit events.
 */

"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { stripeAnyKeyPrefixRegex } = require("./stripe-scan-patterns");

// Configuration
const AUDIT_DIR = ".guardrail/audit";
const AUDIT_FILE = "audit.log.jsonl";
const GENESIS_HASH = "0".repeat(64);

// Tier from environment or default
function getCurrentTier() {
  return process.env.GUARDRAIL_TIER || "free";
}

// Get current actor from environment
function getCurrentActor() {
  const userId = process.env.GUARDRAIL_USER_ID || process.env.USER || process.env.USERNAME || "anonymous";
  const userName = process.env.GUARDRAIL_USER_NAME || process.env.USERNAME;
  const userEmail = process.env.GUARDRAIL_USER_EMAIL;
  
  // Detect CI environment
  if (process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI) {
    return {
      id: process.env.GITHUB_ACTOR || process.env.GITLAB_USER_LOGIN || "ci-system",
      type: "ci",
      name: process.env.GITHUB_ACTOR || process.env.GITLAB_USER_NAME,
    };
  }
  
  return {
    id: userId,
    type: "user",
    name: userName,
    email: userEmail,
  };
}

// Redaction patterns for sensitive data
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
  
  // Compliance+ gets full metadata (still redact secrets)
  if (["compliance", "enterprise", "unlimited"].includes(tier)) {
    return redactObject(metadata);
  }
  
  // Pro gets limited metadata
  if (tier === "pro") {
    return {
      command: metadata.command,
      score: metadata.score,
      grade: metadata.grade,
      issueCount: metadata.issueCount,
      fixCount: metadata.fixCount,
      durationMs: metadata.durationMs,
      errorCode: metadata.errorCode,
    };
  }
  
  // Free/Starter get minimal
  return {
    score: metadata.score,
    grade: metadata.grade,
  };
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

// Compute SHA-256 hash
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

// Get audit file path
function getAuditFilePath(basePath = process.cwd()) {
  return path.join(basePath, AUDIT_DIR, AUDIT_FILE);
}

// Ensure audit directory exists
function ensureAuditDir(basePath = process.cwd()) {
  const dir = path.join(basePath, AUDIT_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Get last hash from audit log
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

// Create audit event
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

// Emit audit event
function emit(input, basePath = process.cwd()) {
  try {
    ensureAuditDir(basePath);
    const prevHash = getLastHash(basePath);
    const event = createEvent(input, prevHash);
    
    const filePath = getAuditFilePath(basePath);
    fs.appendFileSync(filePath, JSON.stringify(event) + "\n", "utf8");
    
    return event;
  } catch (err) {
    // Silently fail - audit should not break main functionality
    if (process.env.GUARDRAIL_DEBUG) {
      console.error("[audit] Failed to emit event:", err.message);
    }
    return null;
  }
}

// Pre-defined actions
const AuditActions = {
  SCAN_START: "scan.start",
  SCAN_COMPLETE: "scan.complete",
  SCAN_ERROR: "scan.error",
  SHIP_CHECK: "ship.check",
  SHIP_APPROVE: "ship.approve",
  SHIP_REJECT: "ship.reject",
  REALITY_START: "reality.start",
  REALITY_COMPLETE: "reality.complete",
  REALITY_ERROR: "reality.error",
  AUTOPILOT_ENABLE: "autopilot.enable",
  AUTOPILOT_DISABLE: "autopilot.disable",
  AUTOPILOT_RUN: "autopilot.run",
  AUTOPILOT_REPORT: "autopilot.report",
  FIX_PLAN: "fix.plan",
  FIX_APPLY: "fix.apply",
  FIX_REVERT: "fix.revert",
  GATE_CHECK: "gate.check",
  GATE_PASS: "gate.pass",
  GATE_FAIL: "gate.fail",
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  TOOL_INVOKE: "tool.invoke",
  TOOL_COMPLETE: "tool.complete",
  TOOL_ERROR: "tool.error",
};

// Convenience emitters
function emitScanStart(projectPath, args) {
  return emit({
    surface: "cli",
    action: AuditActions.SCAN_START,
    category: "scan",
    target: { type: "project", path: projectPath },
    result: "success",
    metadata: { command: "scan", args, projectPath },
  });
}

function emitScanComplete(projectPath, result, metadata) {
  return emit({
    surface: "cli",
    action: AuditActions.SCAN_COMPLETE,
    category: "scan",
    target: { type: "project", path: projectPath },
    result,
    metadata: { command: "scan", projectPath, ...metadata },
  });
}

function emitShipCheck(projectPath, result, metadata) {
  return emit({
    surface: "cli",
    action: AuditActions.SHIP_CHECK,
    category: "ship",
    target: { type: "project", path: projectPath },
    result,
    metadata: { command: "ship", projectPath, ...metadata },
  });
}

function emitRealityStart(url, flows) {
  return emit({
    surface: "cli",
    action: AuditActions.REALITY_START,
    category: "reality",
    target: { type: "url", path: url },
    result: "success",
    metadata: { command: "reality", url, flows },
  });
}

function emitRealityComplete(url, result, metadata) {
  return emit({
    surface: "cli",
    action: AuditActions.REALITY_COMPLETE,
    category: "reality",
    target: { type: "url", path: url },
    result,
    metadata: { command: "reality", ...metadata },
  });
}

function emitAutopilotAction(action, projectPath, result, metadata) {
  const actionMap = {
    enable: AuditActions.AUTOPILOT_ENABLE,
    disable: AuditActions.AUTOPILOT_DISABLE,
    run: AuditActions.AUTOPILOT_RUN,
    report: AuditActions.AUTOPILOT_REPORT,
  };
  
  return emit({
    surface: "cli",
    action: actionMap[action] || action,
    category: "autopilot",
    target: { type: "project", path: projectPath },
    result,
    metadata: { command: "autopilot", projectPath, ...metadata },
  });
}

function emitFixPlan(projectPath, result, metadata) {
  return emit({
    surface: "cli",
    action: AuditActions.FIX_PLAN,
    category: "fix",
    target: { type: "project", path: projectPath },
    result,
    metadata: { command: "fix", projectPath, ...metadata },
  });
}

function emitFixApply(projectPath, result, metadata) {
  return emit({
    surface: "cli",
    action: AuditActions.FIX_APPLY,
    category: "fix",
    target: { type: "project", path: projectPath },
    result,
    metadata: { command: "fix", projectPath, ...metadata },
  });
}

function emitGateCheck(projectPath, passed, metadata) {
  return emit({
    surface: "cli",
    action: passed ? AuditActions.GATE_PASS : AuditActions.GATE_FAIL,
    category: "gate",
    target: { type: "project", path: projectPath },
    result: passed ? "success" : "failure",
    metadata: { command: "gate", projectPath, ...metadata },
  });
}

function emitToolInvoke(surface, toolName, args, result, metadata) {
  return emit({
    surface,
    action: AuditActions.TOOL_INVOKE,
    category: "tool",
    target: { type: "tool", name: toolName },
    result,
    metadata: { command: toolName, args, ...metadata },
  });
}

function emitAuth(action, result, metadata) {
  const actionMap = {
    login: AuditActions.AUTH_LOGIN,
    logout: AuditActions.AUTH_LOGOUT,
  };
  
  return emit({
    surface: "cli",
    action: actionMap[action] || action,
    category: "auth",
    target: { type: "auth" },
    result,
    metadata,
  });
}

// Export the audit bridge
module.exports = {
  emit,
  AuditActions,
  emitScanStart,
  emitScanComplete,
  emitShipCheck,
  emitRealityStart,
  emitRealityComplete,
  emitAutopilotAction,
  emitFixPlan,
  emitFixApply,
  emitGateCheck,
  emitToolInvoke,
  emitAuth,
  getCurrentTier,
  getCurrentActor,
  getAuditFilePath,
};
