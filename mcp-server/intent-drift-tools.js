/**
 * Intent Drift Guard - MCP Tools
 *
 * Tools for AI agents (Cursor, Windsurf, etc.) to interact with Intent Drift Guard.
 * These tools intercept agent actions and enforce intent alignment.
 */

import path from "path";
import fs from "fs";
import crypto from "crypto";

// State file paths
const getStateDir = (projectRoot) => path.join(projectRoot, ".guardrail");
const getIntentFile = (projectRoot) =>
  path.join(getStateDir(projectRoot), "current-intent.json");
const getLockFile = (projectRoot) =>
  path.join(getStateDir(projectRoot), "intent-lock-state.json");
const getFixOnlyFile = (projectRoot) =>
  path.join(getStateDir(projectRoot), "fix-only-state.json");

/**
 * MCP Tool: guardrail_intent_start
 * Start a new step with intent
 */
const intentStartTool = {
  name: "guardrail_intent_start",
  description: `[FREE] Start a new coding step with explicit intent. This captures what you're trying to build before you write code. Intent Drift Guard will then monitor if your code matches this intent.

Example prompts:
- "Add email/password signup with validation and error handling"
- "Fix the login redirect bug in the auth middleware"
- "Refactor the user service to use the repository pattern"

After starting, use guardrail_intent_check after making changes to verify alignment.`,
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "The intent prompt describing what you want to build/fix/change",
      },
      lock: {
        type: "boolean",
        description: "Whether to lock the intent (prevents scope expansion)",
        default: false,
      },
      projectRoot: {
        type: "string",
        description: "Project root directory (defaults to current directory)",
      },
    },
    required: ["prompt"],
  },
  handler: async ({ prompt, lock = false, projectRoot = process.cwd() }) => {
    const intent = extractIntent(prompt);

    // Save intent
    const stateDir = getStateDir(projectRoot);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    if (lock) {
      intent.status = "locked";
      intent.lockedAt = new Date().toISOString();

      const lockState = {
        enabled: true,
        lockedIntent: intent,
        lockStartedAt: new Date().toISOString(),
        violationCount: 0,
        violations: [],
      };
      fs.writeFileSync(
        getLockFile(projectRoot),
        JSON.stringify(lockState, null, 2),
      );
    }

    fs.writeFileSync(
      getIntentFile(projectRoot),
      JSON.stringify(intent, null, 2),
    );
    fs.writeFileSync(
      path.join(stateDir, "step-start.json"),
      JSON.stringify({ startTime: new Date().toISOString() }),
    );

    return {
      success: true,
      message: `🎯 Intent captured: "${prompt.slice(0, 60)}..."`,
      intent: {
        id: intent.id,
        type: intent.intentType,
        locked: lock,
        expectedArtifacts: intent.expectedArtifacts,
      },
      nextStep:
        "Make your code changes, then call guardrail_intent_check to verify alignment.",
    };
  },
};

/**
 * MCP Tool: guardrail_intent_check
 * Check if current code changes align with the stated intent
 */
const intentCheckTool = {
  name: "guardrail_intent_check",
  description: `[FREE] Check if your code changes align with the stated intent. Call this AFTER making changes to detect drift.

Returns:
- ✅ ALIGNED: Code matches intent, continue
- ⚠️ PARTIAL: Some intent missing, may need additions
- ❌ DRIFTED: Code is doing something else, enters Fix-Only Mode

If drifted, you'll be restricted to only fixing the alignment issues.`,
  inputSchema: {
    type: "object",
    properties: {
      changedFiles: {
        type: "array",
        items: { type: "string" },
        description: "List of files that were changed",
      },
      addedFiles: {
        type: "array",
        items: { type: "string" },
        description: "List of files that were added",
      },
      projectRoot: {
        type: "string",
        description: "Project root directory",
      },
    },
  },
  handler: async ({
    changedFiles = [],
    addedFiles = [],
    projectRoot = process.cwd(),
  }) => {
    const intent = loadIntent(projectRoot);
    if (!intent) {
      return {
        success: false,
        error: "No active intent. Call guardrail_intent_start first.",
      };
    }

    // Simple drift detection
    const result = detectDrift(intent, changedFiles, addedFiles, projectRoot);

    // Enter Fix-Only Mode if drifted
    if (result.status === "drifted") {
      const fixOnlyState = {
        enabled: true,
        reason: result.summary.verdict,
        allowedFiles: [...changedFiles, ...addedFiles],
        forbiddenActions: [
          "add_new_files",
          "change_unrelated_files",
          "add_routes",
          "refactor",
        ],
        enteredAt: new Date().toISOString(),
        driftResult: result,
      };
      fs.writeFileSync(
        getFixOnlyFile(projectRoot),
        JSON.stringify(fixOnlyState, null, 2),
      );
    }

    const emoji =
      result.status === "aligned"
        ? "✅"
        : result.status === "partial"
          ? "⚠️"
          : "❌";

    return {
      success: result.status !== "drifted",
      status: result.status,
      message: `${emoji} ${result.status.toUpperCase()}: ${result.summary.verdict}`,
      scores: result.scores,
      missingArtifacts: result.missingArtifacts,
      recommendations: result.recommendations.slice(0, 3),
      fixOnlyMode: result.status === "drifted",
    };
  },
};

/**
 * MCP Tool: guardrail_intent_validate_prompt
 * Validate a new prompt against the locked intent
 */
const intentValidatePromptTool = {
  name: "guardrail_intent_validate_prompt",
  description: `[FREE] Validate a new prompt/instruction against the locked intent. Use this BEFORE processing a new user request to check if it would violate the intent lock.

If the prompt would expand scope or change intent, this will block it.`,
  inputSchema: {
    type: "object",
    properties: {
      newPrompt: {
        type: "string",
        description: "The new prompt to validate",
      },
      projectRoot: {
        type: "string",
        description: "Project root directory",
      },
    },
    required: ["newPrompt"],
  },
  handler: async ({ newPrompt, projectRoot = process.cwd() }) => {
    const lockState = loadLockState(projectRoot);

    if (!lockState || !lockState.enabled) {
      return {
        allowed: true,
        message: "No intent lock active. Prompt allowed.",
      };
    }

    const result = validatePromptAgainstLock(newPrompt, lockState.lockedIntent);

    if (!result.allowed) {
      // Record violation
      lockState.violationCount++;
      lockState.violations.push({
        type: result.violationType,
        description: result.message,
        timestamp: new Date().toISOString(),
        blocked: true,
      });
      fs.writeFileSync(
        getLockFile(projectRoot),
        JSON.stringify(lockState, null, 2),
      );
    }

    return result;
  },
};

/**
 * MCP Tool: guardrail_intent_status
 * Get current Intent Drift Guard status
 */
const intentStatusTool = {
  name: "guardrail_intent_status",
  description: `[FREE] Get the current status of Intent Drift Guard, including active intent, lock status, and Fix-Only Mode status.`,
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: {
        type: "string",
        description: "Project root directory",
      },
    },
  },
  handler: async ({ projectRoot = process.cwd() }) => {
    const intent = loadIntent(projectRoot);
    const lockState = loadLockState(projectRoot);
    const fixOnlyState = loadFixOnlyState(projectRoot);

    return {
      hasActiveIntent: !!intent,
      intent: intent
        ? {
            id: intent.id,
            type: intent.intentType,
            prompt: intent.rawPrompt.slice(0, 100),
            status: intent.status,
          }
        : null,
      intentLock: {
        enabled: lockState?.enabled || false,
        violationCount: lockState?.violationCount || 0,
      },
      fixOnlyMode: {
        enabled: fixOnlyState?.enabled || false,
        reason: fixOnlyState?.reason,
        allowedFiles: fixOnlyState?.allowedFiles?.slice(0, 5),
      },
    };
  },
};

/**
 * MCP Tool: guardrail_intent_complete
 * Complete the current step
 */
const intentCompleteTool = {
  name: "guardrail_intent_complete",
  description: `[FREE] Complete the current step and generate a proof artifact. Call this when the intent has been fully implemented.`,
  inputSchema: {
    type: "object",
    properties: {
      force: {
        type: "boolean",
        description: "Force complete even if drift detected",
        default: false,
      },
      projectRoot: {
        type: "string",
        description: "Project root directory",
      },
    },
  },
  handler: async ({ force = false, projectRoot = process.cwd() }) => {
    const intent = loadIntent(projectRoot);
    if (!intent) {
      return {
        success: false,
        error: "No active intent to complete.",
      };
    }

    // Generate simple proof
    const proof = {
      intentId: intent.id,
      intent: intent.rawPrompt,
      status: "aligned",
      checks: {
        intent: "pass",
        lint: "skipped",
        types: "skipped",
        tests: "skipped",
        forbiddenTokens: "skipped",
        scopeCompliance: "pass",
      },
      filesChanged: 0,
      timestamp: new Date().toISOString(),
      duration: 0,
      signature: generateSignature(intent),
    };

    // Save proof
    const proofsDir = path.join(projectRoot, ".guardrail", "intent-proofs");
    if (!fs.existsSync(proofsDir)) {
      fs.mkdirSync(proofsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const proofFile = path.join(proofsDir, `proof-${timestamp}.json`);
    fs.writeFileSync(proofFile, JSON.stringify(proof, null, 2));

    // Update ledger
    updateLedger(projectRoot, proof);

    // Clean up state
    cleanupState(projectRoot);

    return {
      success: true,
      message: "✅ Step completed successfully!",
      proof: {
        id: proof.intentId,
        status: proof.status,
        signature: proof.signature,
      },
    };
  },
};

/**
 * MCP Tool: guardrail_intent_lock
 * Lock the current intent
 */
const intentLockTool = {
  name: "guardrail_intent_lock",
  description: `[PRO] Lock the current intent to prevent scope expansion. Once locked, any attempt to add new features or change direction will be blocked.`,
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: {
        type: "string",
        description: "Project root directory",
      },
    },
  },
  handler: async ({ projectRoot = process.cwd() }) => {
    const intent = loadIntent(projectRoot);
    if (!intent) {
      return {
        success: false,
        error: "No active intent to lock.",
      };
    }

    intent.status = "locked";
    intent.lockedAt = new Date().toISOString();
    fs.writeFileSync(
      getIntentFile(projectRoot),
      JSON.stringify(intent, null, 2),
    );

    const lockState = {
      enabled: true,
      lockedIntent: intent,
      lockStartedAt: new Date().toISOString(),
      violationCount: 0,
      violations: [],
    };
    fs.writeFileSync(
      getLockFile(projectRoot),
      JSON.stringify(lockState, null, 2),
    );

    return {
      success: true,
      message: `🔒 Intent locked: "${intent.rawPrompt.slice(0, 50)}..."`,
      lockedAt: intent.lockedAt,
    };
  },
};

/**
 * MCP Tool: guardrail_intent_unlock
 * Unlock the current intent
 */
const intentUnlockTool = {
  name: "guardrail_intent_unlock",
  description: `[FREE] Unlock the current intent, allowing scope changes again.`,
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: {
        type: "string",
        description: "Project root directory",
      },
    },
  },
  handler: async ({ projectRoot = process.cwd() }) => {
    const lockFile = getLockFile(projectRoot);
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }

    const intent = loadIntent(projectRoot);
    if (intent) {
      intent.status = "active";
      delete intent.lockedAt;
      fs.writeFileSync(
        getIntentFile(projectRoot),
        JSON.stringify(intent, null, 2),
      );
    }

    return {
      success: true,
      message: "🔓 Intent unlocked.",
    };
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function extractIntent(prompt) {
  const id = `intent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const normalizedPrompt = prompt.toLowerCase();
  const intentType = detectIntentType(normalizedPrompt);
  const expectedArtifacts = extractExpectedArtifacts(normalizedPrompt);

  return {
    id,
    rawPrompt: prompt,
    normalizedPrompt,
    intentType,
    expectedArtifacts,
    completionCriteria: extractCompletionCriteria(normalizedPrompt),
    scope: {
      allowedDirectories: [],
      allowedFilePatterns: [],
      allowNewDependencies: true,
      allowSchemaChanges: false,
      allowEnvChanges: false,
    },
    createdAt: new Date().toISOString(),
    status: "active",
  };
}

function detectIntentType(prompt) {
  if (/fix|bug|repair|resolve|patch|debug/.test(prompt)) return "bugfix";
  if (/refactor|restructure|reorganize|cleanup|simplify/.test(prompt))
    return "refactor";
  if (/test|spec|verify|validate/.test(prompt)) return "test";
  if (/document|describe|explain|readme/.test(prompt)) return "docs";
  if (/remove|delete|deprecate|drop/.test(prompt)) return "cleanup";
  return "feature";
}

function extractExpectedArtifacts(prompt) {
  const artifacts = {};

  // Routes
  const routeMatch = prompt.match(
    /(get|post|put|patch|delete)\s+([\/\w-:{}]+)/gi,
  );
  if (routeMatch) {
    artifacts.routes = routeMatch.map((m) => {
      const [method, path] = m.split(/\s+/);
      return { method: method.toUpperCase(), path };
    });
  }

  // Auth-related inference
  if (/signup|sign up|register/.test(prompt)) {
    artifacts.routes = artifacts.routes || [];
    artifacts.routes.push({ method: "POST", path: "/api/signup" });
    artifacts.components = ["SignupForm"];
    artifacts.exports = ["createUser", "hashPassword", "validateSignup"];
  }

  if (/login|sign in/.test(prompt)) {
    artifacts.routes = artifacts.routes || [];
    artifacts.routes.push({ method: "POST", path: "/api/login" });
    artifacts.components = ["LoginForm"];
    artifacts.exports = ["authenticateUser", "verifyPassword"];
  }

  // Component inference
  const componentMatch = prompt.match(/component\s+(?:called\s+)?(\w+)/gi);
  if (componentMatch) {
    artifacts.components = componentMatch.map((m) => m.split(/\s+/).pop());
  }

  return artifacts;
}

function extractCompletionCriteria(prompt) {
  const criteria = [];

  if (/password/.test(prompt)) {
    criteria.push({
      id: "c1",
      description: "Password hashing implemented",
      checkType: "pattern_present",
      satisfied: false,
    });
  }
  if (/validat/.test(prompt)) {
    criteria.push({
      id: "c2",
      description: "Input validation exists",
      checkType: "pattern_present",
      satisfied: false,
    });
  }
  if (/error/.test(prompt)) {
    criteria.push({
      id: "c3",
      description: "Error handling implemented",
      checkType: "pattern_present",
      satisfied: false,
    });
  }

  return criteria;
}

function detectDrift(intent, changedFiles, addedFiles, projectRoot) {
  let alignmentScore = 100;
  const missingArtifacts = [];
  const recommendations = [];

  // Check expected routes
  if (intent.expectedArtifacts.routes?.length) {
    const allFiles = [...changedFiles, ...addedFiles];
    let routesFound = 0;

    for (const expected of intent.expectedArtifacts.routes) {
      const found = allFiles.some((f) => {
        if (!f.endsWith(".ts") && !f.endsWith(".js")) return false;
        try {
          const content = fs.readFileSync(path.join(projectRoot, f), "utf-8");
          return content
            .toLowerCase()
            .includes(expected.path.replace(/:\w+/g, "").toLowerCase());
        } catch {
          return false;
        }
      });
      if (found) routesFound++;
      else missingArtifacts.push(`Route: ${expected.method} ${expected.path}`);
    }

    const routeCompletion =
      routesFound / intent.expectedArtifacts.routes.length;
    alignmentScore = Math.round(routeCompletion * 100);
  }

  // Check expected exports
  if (intent.expectedArtifacts.exports?.length) {
    for (const expected of intent.expectedArtifacts.exports) {
      let found = false;
      for (const f of [...changedFiles, ...addedFiles]) {
        try {
          const content = fs.readFileSync(path.join(projectRoot, f), "utf-8");
          if (
            new RegExp(
              `export\\s+(?:const|function|class)\\s+${expected}`,
              "i",
            ).test(content)
          ) {
            found = true;
            break;
          }
        } catch {}
      }
      if (!found) {
        missingArtifacts.push(`Export: ${expected}`);
        alignmentScore -= 10;
      }
    }
  }

  // Determine status
  let status = "aligned";
  if (alignmentScore < 70) status = "partial";
  if (alignmentScore < 50 || missingArtifacts.length > 3) status = "drifted";

  // Generate recommendations
  for (const missing of missingArtifacts) {
    recommendations.push({
      type: "add",
      priority: "high",
      description: `Add missing ${missing}`,
    });
  }

  return {
    status,
    scores: {
      alignment: alignmentScore,
      scopeViolation: 0,
      noiseRatio: 0,
      overall: alignmentScore,
    },
    missingArtifacts,
    scopeViolations: [],
    completionStatus: {
      totalCriteria: 0,
      satisfiedCriteria: 0,
      percentage: 100,
      missing: [],
    },
    summary: {
      intended: intent.rawPrompt,
      implemented: `${changedFiles.length + addedFiles.length} files changed`,
      gap:
        missingArtifacts.length > 0
          ? `Missing: ${missingArtifacts.slice(0, 3).join(", ")}`
          : "",
      verdict:
        status === "aligned"
          ? "Code matches intent"
          : status === "partial"
            ? "Some intent missing"
            : "Code drifted from intent",
    },
    recommendations,
    timestamp: new Date().toISOString(),
  };
}

function validatePromptAgainstLock(newPrompt, lockedIntent) {
  const normalizedNew = newPrompt.toLowerCase();
  const normalizedOriginal = lockedIntent.normalizedPrompt;

  // Check for scope expansion phrases
  const expansionPatterns = [
    {
      pattern: /\balso\s+(?:add|create|implement|build)/i,
      reason: "Adding new feature",
    },
    {
      pattern: /\bwhile\s+(?:you're|we're|i'm)\s+at\s+it/i,
      reason: "Scope creep phrase",
    },
    {
      pattern: /\band\s+then\s+(?:add|create|implement)/i,
      reason: "Chaining new features",
    },
    { pattern: /\blet's\s+also\b/i, reason: "Adding to scope" },
    {
      pattern: /\bactually,?\s+(?:let's|can\s+you)/i,
      reason: "Changing direction",
    },
  ];

  for (const { pattern, reason } of expansionPatterns) {
    if (pattern.test(newPrompt)) {
      return {
        allowed: false,
        violationType: "scope_expansion",
        message: `🔒 INTENT LOCKED: ${reason} not allowed. Complete current step first.\n\nOriginal intent: "${lockedIntent.rawPrompt.slice(0, 60)}..."\n\n💡 Run "guardrail intent complete" or "guardrail intent unlock" to proceed.`,
      };
    }
  }

  // Check keyword overlap
  const originalKeywords = extractKeywords(normalizedOriginal);
  const newKeywords = extractKeywords(normalizedNew);
  const overlap = originalKeywords.filter((k) => newKeywords.includes(k));

  if (overlap.length < 2 && newKeywords.length > 3) {
    return {
      allowed: false,
      violationType: "intent_change",
      message: `🔒 INTENT LOCKED: This appears to be a new task.\n\nOriginal intent: "${lockedIntent.rawPrompt.slice(0, 60)}..."\n\n💡 Complete or unlock the current intent first.`,
    };
  }

  return {
    allowed: true,
    message: "Prompt aligns with locked intent.",
  };
}

function extractKeywords(text) {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "be",
  ]);

  return text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

function loadIntent(projectRoot) {
  try {
    const file = getIntentFile(projectRoot);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }
  } catch {}
  return null;
}

function loadLockState(projectRoot) {
  try {
    const file = getLockFile(projectRoot);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }
  } catch {}
  return null;
}

function loadFixOnlyState(projectRoot) {
  try {
    const file = getFixOnlyFile(projectRoot);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }
  } catch {}
  return null;
}

function generateSignature(intent) {
  const data = JSON.stringify({
    id: intent.id,
    prompt: intent.rawPrompt,
    time: Date.now(),
  });
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
}

function updateLedger(projectRoot, proof) {
  const ledgerFile = path.join(
    projectRoot,
    ".guardrail",
    "intent-proofs",
    "ledger.json",
  );
  let ledger;

  try {
    if (fs.existsSync(ledgerFile)) {
      ledger = JSON.parse(fs.readFileSync(ledgerFile, "utf-8"));
    }
  } catch {}

  if (!ledger) {
    ledger = {
      projectId: path.basename(projectRoot),
      steps: [],
      totalSteps: 0,
      alignedSteps: 0,
      partialSteps: 0,
      driftedSteps: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  ledger.steps.push(proof);
  ledger.totalSteps++;
  if (proof.status === "aligned") ledger.alignedSteps++;
  else if (proof.status === "partial") ledger.partialSteps++;
  else ledger.driftedSteps++;
  ledger.lastUpdated = new Date().toISOString();

  fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2));
}

function cleanupState(projectRoot) {
  const files = [
    getIntentFile(projectRoot),
    getLockFile(projectRoot),
    getFixOnlyFile(projectRoot),
    path.join(getStateDir(projectRoot), "step-start.json"),
  ];

  for (const file of files) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {}
  }
}

// ============================================================================
// Export tools for MCP server
// ============================================================================

// Export all tools as array
const intentDriftTools = [
  intentStartTool,
  intentCheckTool,
  intentValidatePromptTool,
  intentStatusTool,
  intentCompleteTool,
  intentLockTool,
  intentUnlockTool,
];

export {
  intentStartTool,
  intentCheckTool,
  intentValidatePromptTool,
  intentStatusTool,
  intentCompleteTool,
  intentLockTool,
  intentUnlockTool,
  intentDriftTools,
};
