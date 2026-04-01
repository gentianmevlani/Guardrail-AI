/**
 * Verification Module - Pure JavaScript Implementation
 * For CLI usage without TypeScript compilation
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { stripeSkLiveRegex24 } = require("./stripe-scan-patterns");

// Constants
const PROTECTED_PATHS = [
  ".git",
  "node_modules",
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
];

const DANGEROUS_COMMANDS = [
  "rm -rf",
  "rm -r /",
  "rmdir /s",
  "del /f /s /q",
  "sudo",
  "chmod 777",
  "curl | bash",
  "curl | sh",
  "wget | bash",
  "wget | sh",
  "> /dev/sd",
  "mkfs",
  "dd if=",
  ":(){:|:&};:",
  "format c:",
  "rd /s /q",
];

const SECRET_PATTERNS = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g, severity: "critical" },
  { name: "GitHub Token", pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g, severity: "critical" },
  { name: "Stripe Key", pattern: stripeSkLiveRegex24(), severity: "critical" },
  { name: "Private Key", pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: "critical" },
  { name: "Database URL", pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/gi, severity: "critical" },
];

const STUB_PATTERNS = [
  { name: "Placeholder function", pattern: /throw new Error\(['"]not implemented['"]\)/gi },
  { name: "Console placeholder", pattern: /console\.log\(['"]placeholder['"]\)/gi },
  { name: "Lorem ipsum", pattern: /lorem\s+ipsum/gi },
  { name: "NotImplementedError", pattern: /raise NotImplementedError/g },
  { name: "unimplemented!", pattern: /unimplemented!\(\)/g },
  { name: "todo!", pattern: /todo!\(\)/g },
];

const FORMAT_RETRY_PROMPT = `Your response was not in the required format. Please respond with ONLY valid JSON in this exact structure:

{
  "format": "guardrail-v1",
  "diff": "<unified diff for ALL file changes>",
  "commands": ["optional array of commands to run"],
  "tests": ["optional array of test commands"],
  "notes": "optional notes"
}

If you cannot provide the requested changes, respond with:
{ "format": "guardrail-v1", "error": "reason why you cannot provide the changes" }

Do NOT include any markdown fencing, explanations, or text outside the JSON object.`;

const DIFF_FORMAT_RETRY_PROMPT = `Your diff is malformed. The diff field must be a valid unified diff containing:
- File headers starting with "diff --git a/path b/path"
- Old file marker "--- a/path" or "--- /dev/null" for new files
- New file marker "+++ b/path"
- Hunk headers like "@@ -start,count +start,count @@"

Please regenerate your response with a properly formatted unified diff.`;

// Extract JSON from raw input
function extractJson(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const jsonFenceMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonFenceMatch) return jsonFenceMatch[1].trim();

  const plainFenceMatch = trimmed.match(/```\s*([\s\S]*?)\s*```/);
  if (plainFenceMatch) {
    const content = plainFenceMatch[1].trim();
    if (content.startsWith("{")) return content;
  }

  return null;
}

// Validate diff structure
function isValidDiffStructure(diff) {
  if (!diff || typeof diff !== "string" || diff.trim().length === 0) return false;
  const hasDiffHeader = diff.includes("diff --git") || diff.includes("diff -");
  const hasOldMarker = diff.includes("---");
  const hasNewMarker = diff.includes("+++");
  const hasHunk = /@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(diff);
  return hasDiffHeader && hasOldMarker && hasNewMarker && hasHunk;
}

// Parse diff to extract files
function parseDiff(diffStr) {
  const files = [];
  const fileChunks = diffStr.split(/^diff --git /m).filter(Boolean);

  for (const chunk of fileChunks) {
    const lines = chunk.split("\n");
    if (lines.length === 0) continue;
    const headerMatch = lines[0].match(/a\/(.+?)\s+b\/(.+)/);
    if (!headerMatch) continue;
    files.push({ path: headerMatch[2], additions: 0, deletions: 0 });
  }

  return { files, totalFiles: files.length };
}

// Validate format
function validateFormat(raw) {
  if (!raw || typeof raw !== "string") {
    return { valid: false, retryPrompt: FORMAT_RETRY_PROMPT, error: "Empty input" };
  }

  const jsonStr = extractJson(raw);
  if (!jsonStr) {
    return { valid: false, retryPrompt: FORMAT_RETRY_PROMPT, error: "Could not extract JSON" };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return { valid: false, retryPrompt: FORMAT_RETRY_PROMPT, error: `JSON parse error: ${e.message}` };
  }

  if (!parsed || typeof parsed !== "object") {
    return { valid: false, retryPrompt: FORMAT_RETRY_PROMPT, error: "Response must be a JSON object" };
  }

  if (parsed.format !== "guardrail-v1") {
    return { valid: false, retryPrompt: FORMAT_RETRY_PROMPT, error: `Invalid format: ${parsed.format}` };
  }

  if (parsed.error) {
    return { valid: true, output: { format: "guardrail-v1", diff: "", error: parsed.error } };
  }

  if (typeof parsed.diff !== "string" || parsed.diff.trim().length === 0) {
    return { valid: false, retryPrompt: DIFF_FORMAT_RETRY_PROMPT, error: "Empty diff" };
  }

  if (!isValidDiffStructure(parsed.diff)) {
    return { valid: false, retryPrompt: DIFF_FORMAT_RETRY_PROMPT, error: "Invalid diff structure" };
  }

  return { valid: true, output: parsed };
}

// Validate path
function validatePath(filePath) {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");

  if (normalized.includes("..") || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    return { status: "fail", message: `Path traversal detected: ${filePath}` };
  }

  for (const protected_ of PROTECTED_PATHS) {
    if (normalized === protected_ || normalized.startsWith(protected_ + "/")) {
      return { status: "fail", message: `Protected path: ${filePath}` };
    }
  }

  return { status: "pass", message: `Safe: ${normalized}` };
}

// Validate command
function validateCommand(command) {
  const normalized = command.toLowerCase().trim();
  for (const dangerous of DANGEROUS_COMMANDS) {
    if (normalized.includes(dangerous.toLowerCase())) {
      return { status: "fail", message: `Dangerous command: ${command}` };
    }
  }
  return { status: "pass", message: "Safe command" };
}

// Detect secrets
function detectSecrets(content, filePath) {
  if (filePath.endsWith(".md") || filePath.includes("__mocks__")) {
    return { status: "pass", message: "Skipped" };
  }

  for (const { name, pattern, severity } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      return { status: "fail", message: `${severity.toUpperCase()} secret: ${name}` };
    }
  }
  return { status: "pass", message: "No secrets" };
}

// Detect stubs
function detectStubs(content, mode) {
  for (const { name, pattern } of STUB_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      return { status: "fail", message: `Placeholder code: ${name}` };
    }
  }
  return { status: "pass", message: "No stubs" };
}

// Build failure context
function buildFailureContext(blockers) {
  if (blockers.length === 0) return "";

  const top3 = blockers.slice(0, 3);
  return `## Verification Failed

Fix ONLY these issues. Return corrected diff in guardrail-v1 JSON format.

### Issues:
${top3.map((b, i) => `${i + 1}. ${b}`).join("\n")}
${blockers.length > 3 ? `\n... and ${blockers.length - 3} more` : ""}

Respond with corrected guardrail-v1 JSON only.`;
}

// Main verification function
async function verifyAgentOutput(rawResponse, context) {
  const checks = [];
  const blockers = [];
  const warnings = [];

  // Format validation
  const formatResult = validateFormat(rawResponse);
  if (!formatResult.valid) {
    return {
      success: false,
      checks: [{ check: "format-validation", status: "fail", message: formatResult.error }],
      blockers: [formatResult.error],
      warnings: [],
      failureContext: formatResult.retryPrompt,
    };
  }

  const output = formatResult.output;

  // Handle error response
  if (output.error) {
    return {
      success: false,
      checks: [{ check: "agent-error", status: "fail", message: output.error }],
      blockers: [`Agent error: ${output.error}`],
      warnings: [],
      parsedOutput: output,
    };
  }

  // Diff structure
  checks.push({ check: "diff-structure", status: "pass", message: "Valid diff" });

  // Path validation
  const parsed = parseDiff(output.diff);
  for (const file of parsed.files) {
    const pathResult = validatePath(file.path);
    if (pathResult.status === "fail") {
      checks.push({ check: "path-safety", status: "fail", message: pathResult.message, file: file.path });
      blockers.push(pathResult.message);
    }
  }
  if (!blockers.some(b => b.includes("Path"))) {
    checks.push({ check: "path-safety", status: "pass", message: `${parsed.files.length} path(s) validated` });
  }

  // Command validation
  if (output.commands && output.commands.length > 0) {
    for (const cmd of output.commands) {
      const cmdResult = validateCommand(cmd);
      if (cmdResult.status === "fail") {
        checks.push({ check: "command-safety", status: "fail", message: cmdResult.message });
        blockers.push(cmdResult.message);
      }
    }
    if (!blockers.some(b => b.includes("Dangerous"))) {
      checks.push({ check: "command-safety", status: "pass", message: `${output.commands.length} command(s) validated` });
    }
  } else {
    checks.push({ check: "command-safety", status: "pass", message: "No commands" });
  }

  // Fail fast on blockers
  if (blockers.length > 0) {
    return {
      success: false,
      checks,
      blockers,
      warnings,
      failureContext: buildFailureContext(blockers),
      parsedOutput: output,
    };
  }

  // Content checks (simplified - check diff content directly)
  const secretCheck = detectSecrets(output.diff, "diff");
  if (secretCheck.status === "fail") {
    checks.push({ check: "secret-detection", status: "fail", message: secretCheck.message });
    blockers.push(secretCheck.message);
  } else {
    checks.push({ check: "secret-detection", status: "pass", message: "No secrets in diff" });
  }

  const stubCheck = detectStubs(output.diff, context.mode);
  if (stubCheck.status === "fail" && context.mode === "ship") {
    checks.push({ check: "stub-detection", status: "fail", message: stubCheck.message });
    blockers.push(stubCheck.message);
  } else if (stubCheck.status === "fail") {
    checks.push({ check: "stub-detection", status: "warn", message: stubCheck.message });
    warnings.push(stubCheck.message);
  } else {
    checks.push({ check: "stub-detection", status: "pass", message: "No placeholder code" });
  }

  const success = blockers.length === 0;
  return {
    success,
    checks,
    blockers,
    warnings,
    failureContext: success ? undefined : buildFailureContext(blockers),
    parsedOutput: output,
  };
}

module.exports = { verifyAgentOutput };
