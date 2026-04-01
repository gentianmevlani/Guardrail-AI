/**
 * guardrail ship - The Vibe Coder's Best Friend
 * Zero config. Plain English. One command to ship with confidence.
 */

const path = require("path");
const fs = require("fs");
const { withErrorHandling } = require("./lib/error-handler");
const { ensureOutputDir, detectProjectFeatures } = require("./utils");
const { enforceLimit, enforceFeature, trackUsage, getCurrentTier } = require("./lib/entitlements");
const { emitShipCheck } = require("./lib/audit-bridge");
const { STRIPE_LIVE_PREFIX } = require("./lib/stripe-scan-patterns");

// ANSI color codes
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

const PLAIN_ENGLISH = {
  secretExposed: (type) => ({
    message: `🔑 Your ${type} is visible in the code - hackers can steal it`,
    why: `If this code is pushed to GitHub or deployed, anyone can see your ${type} and use it maliciously.`,
    fix: `Move this to a .env file and use process.env.${type.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
  }),
  adminExposed: (route) => ({
    message: `🔐 Anyone can access ${route} without logging in`,
    why: `This endpoint has no authentication. Attackers can access admin features directly.`,
    fix: `Add authentication middleware to protect this route.`,
  }),
  mockInProd: (detail) => ({
    message: `🎭 Your code uses fake data instead of real data`,
    why: `Mock/test code in production means users see fake data or features don't work.`,
    fix: `Remove or conditionally disable this mock code for production builds.`,
  }),
  endpointMissing: (route) => ({
    message: `🔗 Button calls ${route} but that endpoint doesn't exist`,
    why: `Your frontend calls an API that doesn't exist - this will cause errors for users.`,
    fix: `Either create the missing endpoint or update the frontend to use the correct URL.`,
  }),
};

function getTrafficLight(score) {
  if (score >= 80) return "🟢";
  if (score >= 50) return "🟡";
  return "🔴";
}

function getVerdict(score, blockers) {
  if (score >= 90 && blockers.length === 0) {
    return {
      emoji: "🚀",
      headline: "Ready to ship!",
      detail: "Your app looks solid. Ship it!",
    };
  }
  if (score >= 70 && blockers.length <= 2) {
    return {
      emoji: "⚠️",
      headline: "Almost ready",
      detail: "A few things to fix, but you're close.",
    };
  }
  if (score >= 50) {
    return {
      emoji: "🛑",
      headline: "Not ready yet",
      detail: "Some important issues need your attention.",
    };
  }
  return {
    emoji: "🚨",
    headline: "Don't ship this!",
    detail: "Critical problems found. Fix these first.",
  };
}

function translateToPlainEnglish(results) {
  const problems = [],
    warnings = [],
    passes = [];

  if (results.integrity?.env?.secrets) {
    for (const secret of results.integrity.env.secrets) {
      if (secret.severity === "critical") {
        const info = PLAIN_ENGLISH.secretExposed(secret.type);
        problems.push({
          category: "Security",
          type: secret.type,
          message: info.message,
          why: info.why,
          fix: info.fix,
          file: `${secret.file}:${secret.line}`,
          line: secret.line,
          rawFile: secret.file,
          fixable: true,
          fixAction: "move-to-env",
        });
      }
    }
  }

  if (results.integrity?.auth?.analysis?.adminExposed?.length > 0) {
    for (const route of results.integrity.auth.analysis.adminExposed) {
      const info = PLAIN_ENGLISH.adminExposed(`${route.method} ${route.path}`);
      problems.push({
        category: "Auth",
        message: info.message,
        why: info.why,
        fix: info.fix,
        file: route.file,
        fixable: false,
        fixAction: "add-auth-middleware",
      });
    }
  }

  if (results.integrity?.mocks?.issues) {
    for (const issue of results.integrity.mocks.issues) {
      if (issue.severity === "critical" || issue.severity === "high") {
        const info = PLAIN_ENGLISH.mockInProd(issue.type);
        problems.push({
          category: "Fake Code",
          message: info.message,
          why: info.why,
          fix: info.fix,
          detail: issue.evidence || issue.type,
          file: `${issue.file}:${issue.line}`,
          fixable: false,
          fixAction: "remove-mock",
        });
      }
    }
  }

  if (!results.integrity?.env?.secrets?.length)
    passes.push({
      category: "Secrets",
      message: "✅ No exposed secrets found",
    });
  if (!results.integrity?.mocks?.issues?.length)
    passes.push({ category: "Code", message: "✅ No fake/mock code found" });

  return { problems, warnings, passes };
}

function printVibeCoderResults(results, translated, outputDir) {
  const { problems, warnings, passes } = translated;
  const score = results.score || 0;
  const light = getTrafficLight(score);
  const verdict = getVerdict(score, problems);

  // Get colors based on score
  const boxColor = score >= 80 ? c.green : score >= 50 ? c.yellow : c.red;
  const scoreColor = score >= 80 ? c.green : score >= 50 ? c.yellow : c.red;

  console.log("");
  console.log(
    `  ${boxColor}╔═════════════════════════════════════════════════════════════════╗${c.reset}`,
  );
  console.log(
    `  ${boxColor}║${c.reset}                                                                 ${boxColor}║${c.reset}`,
  );
  console.log(
    `  ${boxColor}║${c.reset}  ${light}  ${c.bold}${verdict.headline}${c.reset}                                              ${boxColor}║${c.reset}`,
  );
  console.log(
    `  ${boxColor}║${c.reset}     ${c.dim}${verdict.detail}${c.reset}                                  ${boxColor}║${c.reset}`,
  );
  console.log(
    `  ${boxColor}║${c.reset}                                                                 ${boxColor}║${c.reset}`,
  );
  console.log(
    `  ${boxColor}╚═════════════════════════════════════════════════════════════════╝${c.reset}`,
  );
  console.log("");

  if (problems.length > 0) {
    console.log(
      `  ${c.bold}${c.red}🚨 PROBLEMS${c.reset} ${c.dim}(${problems.length} found)${c.reset}\n`,
    );
    for (const p of problems.slice(0, 8)) {
      console.log(`  ${c.red}❌${c.reset} ${c.bold}${p.message}${c.reset}`);
      if (p.why) console.log(`     ${c.dim}Why: ${p.why}${c.reset}`);
      if (p.file) console.log(`     ${c.cyan}📍 ${p.file}${c.reset}`);
      if (p.fix) console.log(`     ${c.green}💡 Fix: ${p.fix}${c.reset}`);
      console.log("");
    }
  }

  if (passes.length > 0) {
    console.log(`  ${c.bold}${c.green}✅ WHAT'S WORKING${c.reset}\n`);
    for (const p of passes) console.log(`  ${c.green}${p.message}${c.reset}`);
    console.log("");
  }

  // Score summary box
  console.log(
    `  ${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`,
  );
  console.log(
    `  ${c.bold}Score:${c.reset} ${scoreColor}${c.bold}${score}${c.reset}/100  ${light}`,
  );
  console.log("");
  if (problems.length > 0) {
    const fixable = problems.filter((p) => p.fixable).length;
    console.log(
      `  ${c.dim}${problems.length} problems found (${fixable} auto-fixable)${c.reset}`,
    );
    console.log(
      `  ${c.dim}Run:${c.reset} ${c.cyan}${c.bold}guardrail ship --fix${c.reset}`,
    );
  } else {
    console.log(`  ${c.green}${c.bold}No critical problems! 🎉${c.reset}`);
  }
  console.log(
    `  ${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`,
  );
  console.log("");
  console.log(
    `  ${c.dim}📄 Full report:${c.reset} ${c.cyan}${outputDir}/report.html${c.reset}\n`,
  );
}

function parseArgs(args) {
  const opts = { fix: false, path: ".", verbose: false, json: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--fix" || a === "-f") opts.fix = true;
    if (a === "--verbose" || a === "-v") opts.verbose = true;
    if (a === "--json") opts.json = true;
    if (a.startsWith("--path=")) opts.path = a.split("=")[1];
    if (a === "--path" || a === "-p") opts.path = args[++i];
    if (a === "--help" || a === "-h") opts.help = true;
  }
  return opts;
}

async function runShip(args) {
  const opts = parseArgs(args);

  if (opts.help) {
    console.log(
      `
guardrail ship - One-click production audit

Usage:
  guardrail ship              Scan your app and show what's wrong
  guardrail ship --fix        Find and fix problems automatically

Options:
  --fix, -f      Auto-fix problems where possible
  --path, -p     Project path (default: current directory)
  --help, -h     Show this help
`.trim(),
    );
    return 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTITLEMENT CHECK
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    await enforceLimit('scans');
    await enforceFeature('ship');
    
    // Check for fix feature (premium)
    if (opts.fix) {
      await enforceFeature('fix');
    }
  } catch (err) {
    if (err.code === 'LIMIT_EXCEEDED' || err.code === 'FEATURE_NOT_AVAILABLE') {
      console.error(err.upgradePrompt || err.message);
      const { EXIT_CODES } = require('./lib/error-handler');
      process.exit(EXIT_CODES.AUTH_FAILURE);
    }
    throw err;
  }
  
  // Track usage
  await trackUsage('scans');

  const projectPath = path.resolve(opts.path);
  const outputDir = path.join(projectPath, ".guardrail");

  console.log(`\n  ${c.bold}${c.magenta}🚀 guardrail SHIP${c.reset}\n`);
  console.log(
    `  ${c.dim}Scanning your app for production readiness...${c.reset}\n`,
  );

  let results = {
    score: 100,
    grade: "A",
    canShip: true,
    deductions: [],
    blockers: [],
    counts: {},
    checks: {},
    outputDir,
  };

  try {
    console.log("  🔍 Checking for problems...");
    const { auditProductionIntegrity } = require(
      path.join(__dirname, "../../scripts/audit-production-integrity.js"),
    );
    const { results: integrityResults, integrity } =
      await auditProductionIntegrity(projectPath);
    results.score = integrity.score;
    results.grade = integrity.grade;
    results.canShip = integrity.canShip;
    results.deductions = integrity.deductions;
    results.integrity = integrityResults;
  } catch (err) {
    if (opts.verbose) console.error("  ⚠️ Integrity check error:", err.message);
  }

  console.log("  ✅ Scan complete!");

  const translated = translateToPlainEnglish(results);

  // Run auto-fix if requested
  if (opts.fix) {
    console.log(`\n  ${c.bold}${c.cyan}🔧 AUTO-FIX MODE${c.reset}\n`);
    const fixResults = await runAutoFix(
      projectPath,
      translated,
      results,
      outputDir,
    );
    printFixResults(fixResults);
  }

  printVibeCoderResults(results, translated, outputDir);

  try {
    const { writeArtifacts } = require("./utils");
    writeArtifacts(outputDir, results);
  } catch (err) {
    // Log but don't fail - artifact writing is non-critical
    console.warn(`${c.yellow}⚠${c.reset} Failed to write artifacts: ${err.message}`);
    if (process.env.DEBUG || process.env.GUARDRAIL_DEBUG) {
      console.error(err.stack);
    }
  }

  // Emit audit event for ship check
  emitShipCheck(projectPath, results.canShip ? 'success' : 'failure', {
    score: results.score,
    grade: results.grade,
    canShip: results.canShip,
    issueCount: translated.problems?.length || 0,
  });

  // JSON output mode - use standardized schema
  if (opts.json) {
    const { createScanResult, validateScanResult } = require('./lib/scan-output-schema');
    
    // Convert results to standardized format
    const findings = (translated.problems || []).map((p, idx) => ({
      id: `finding_${idx}`,
      type: p.type || 'ship_blocker',
      severity: p.severity || 'high',
      message: p.message || p.title || '',
      file: p.file || null,
      line: p.line || null,
      confidence: 0.9,
      blocksShip: !results.canShip,
      suggestedFix: p.fix || null,
    }));
    
    const standardizedResult = createScanResult({
      findings,
      projectPath,
      scanId: `ship_${Date.now()}`,
      startTime: Date.now(),
    });
    
    // Validate before output
    const validation = validateScanResult(standardizedResult);
    if (!validation.valid) {
      console.error(JSON.stringify({
        schemaVersion: "1.0.0",
        success: false,
        error: {
          code: "SCHEMA_VALIDATION_FAILED",
          message: "JSON output validation failed",
          nextSteps: validation.errors,
        },
      }, null, 2));
      const { EXIT_CODES } = require('./lib/error-handler');
      return EXIT_CODES.SYSTEM_ERROR;
    }
    
    console.log(JSON.stringify(standardizedResult, null, 2));
    const { EXIT_CODES } = require('./lib/error-handler');
    return results.canShip ? EXIT_CODES.SUCCESS : EXIT_CODES.POLICY_FAIL;
  }

  return results.canShip ? 0 : 1;
}

/**
 * Safe auto-fix implementation
 * Only performs non-destructive fixes:
 * 1. Creates .env.example with detected secrets as placeholders
 * 2. Updates .gitignore to protect sensitive files
 * 3. Generates fixes.md with detailed manual fix instructions
 */
async function runAutoFix(projectPath, translated, results, outputDir) {
  const fixResults = {
    envExampleCreated: false,
    gitignoreUpdated: false,
    fixesMdCreated: false,
    secretsFound: [],
    errors: [],
  };

  const { ensureOutputDir } = require("./utils");
  ensureOutputDir(outputDir);

  // 1. Create .env.example with detected secrets
  const secretProblems = translated.problems.filter(
    (p) => p.fixAction === "move-to-env",
  );
  if (secretProblems.length > 0) {
    try {
      const envExamplePath = path.join(projectPath, ".env.example");
      const envVars = new Set();

      for (const problem of secretProblems) {
        const varName = problem.type.toUpperCase().replace(/[^A-Z0-9]/g, "_");
        envVars.add(varName);
        fixResults.secretsFound.push({
          type: problem.type,
          varName,
          file: problem.rawFile,
        });
      }

      let envContent = "# Environment Variables Template\n";
      envContent += "# Copy this file to .env and fill in your actual values\n";
      envContent += "# NEVER commit .env to version control!\n\n";

      for (const varName of envVars) {
        envContent += `${varName}=your_${varName.toLowerCase()}_here\n`;
      }

      // Append to existing .env.example or create new
      if (fs.existsSync(envExamplePath)) {
        const existing = fs.readFileSync(envExamplePath, "utf8");
        for (const varName of envVars) {
          if (!existing.includes(varName)) {
            fs.appendFileSync(
              envExamplePath,
              `${varName}=your_${varName.toLowerCase()}_here\n`,
            );
          }
        }
        console.log(
          `  ${c.green}✓${c.reset} Updated ${c.cyan}.env.example${c.reset} with ${envVars.size} variables`,
        );
      } else {
        fs.writeFileSync(envExamplePath, envContent);
        console.log(
          `  ${c.green}✓${c.reset} Created ${c.cyan}.env.example${c.reset} with ${envVars.size} variables`,
        );
      }
      fixResults.envExampleCreated = true;
    } catch (err) {
      fixResults.errors.push(`Failed to create .env.example: ${err.message}`);
    }
  }

  // 2. Update .gitignore to protect sensitive files
  try {
    const gitignorePath = path.join(projectPath, ".gitignore");
    const sensitivePatterns = [
      ".env",
      ".env.local",
      ".env.*.local",
      "*.pem",
      "*.key",
      ".guardrail/artifacts/",
    ];

    let gitignoreContent = "";
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
    }

    const patternsToAdd = sensitivePatterns.filter(
      (p) => !gitignoreContent.includes(p),
    );

    if (patternsToAdd.length > 0) {
      const addition =
        "\n# guardrail: Protect sensitive files\n" +
        patternsToAdd.join("\n") +
        "\n";
      fs.appendFileSync(gitignorePath, addition);
      console.log(
        `  ${c.green}✓${c.reset} Updated ${c.cyan}.gitignore${c.reset} with ${patternsToAdd.length} patterns`,
      );
      fixResults.gitignoreUpdated = true;
    } else {
      console.log(
        `  ${c.dim}✓ .gitignore already protects sensitive files${c.reset}`,
      );
    }
  } catch (err) {
    fixResults.errors.push(`Failed to update .gitignore: ${err.message}`);
  }

  // 3. Generate detailed fixes.md with manual instructions AND AI agent prompt
  try {
    const fixesMdPath = path.join(outputDir, "fixes.md");
    const aiPromptPath = path.join(outputDir, "ai-fix-prompt.md");

    // Group problems by category and dedupe by file
    const byCategory = {};
    const seenFiles = new Set();
    for (const p of translated.problems) {
      // Dedupe: only show first issue per file for same category
      const key = `${p.category}:${p.file}`;
      if (seenFiles.has(key)) continue;
      seenFiles.add(key);

      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    }

    // Read actual file content for context (keyed by file:line to handle multiple issues per file)
    const fileContexts = {};
    const fileContents = {}; // Cache file contents
    for (const problems of Object.values(byCategory)) {
      for (const p of problems) {
        if (p.rawFile) {
          const contextKey = `${p.rawFile}:${p.line || 1}`;
          if (!fileContexts[contextKey]) {
            try {
              // Cache file content
              if (!fileContents[p.rawFile]) {
                const fullPath = path.join(projectPath, p.rawFile);
                if (fs.existsSync(fullPath)) {
                  fileContents[p.rawFile] = fs
                    .readFileSync(fullPath, "utf8")
                    .split("\n");
                }
              }

              if (fileContents[p.rawFile]) {
                const lines = fileContents[p.rawFile];
                const lineNum = p.line || 1;
                const start = Math.max(0, lineNum - 3);
                const end = Math.min(lines.length, lineNum + 3);
                fileContexts[contextKey] = {
                  snippet: lines
                    .slice(start, end)
                    .map((l, i) => `${start + i + 1}: ${l}`)
                    .join("\n"),
                  line: lineNum,
                };
              }
            } catch (e) {
              /* ignore read errors */
            }
          }
          // Store the context key on the problem for later lookup
          p._contextKey = contextKey;
        }
      }
    }

    // Generate human-readable fixes.md
    let md = "# 🔧 guardrail Fix Guide\n\n";
    md += `Generated: ${new Date().toISOString()}\n\n`;

    const totalIssues = Object.values(byCategory).flat().length;
    md += `**${totalIssues} unique issues found across ${Object.keys(byCategory).length} categories**\n\n`;
    md += "---\n\n";

    for (const [category, problems] of Object.entries(byCategory)) {
      md += `## ${category} (${problems.length} files)\n\n`;

      for (const p of problems) {
        md += `### \`${p.file}\`\n\n`;
        md += `**Problem:** ${p.message}\n\n`;
        md += `**Risk:** ${p.why}\n\n`;

        // Show actual code context if available
        if (p._contextKey && fileContexts[p._contextKey]) {
          md += "**Current code:**\n```\n";
          md += fileContexts[p._contextKey].snippet;
          md += "\n```\n\n";
        }

        md += `**Fix:** ${p.fix}\n\n`;

        // Add specific code example for secrets
        if (p.fixAction === "move-to-env" && p.type) {
          const varName = p.type.toUpperCase().replace(/[^A-Z0-9]/g, "_");
          md += "**Replace with:**\n```javascript\n";
          md += `const ${p.type.toLowerCase().replace(/[^a-z0-9]/g, "")} = process.env.${varName};\n`;
          md += "```\n\n";
        }

        md += "---\n\n";
      }
    }

    md += "## Next Steps\n\n";
    md += "1. Copy `.env.example` to `.env` and fill in real values\n";
    md += "2. Apply the fixes above to each file\n";
    md += "3. Run `guardrail ship` again to verify\n\n";
    md += "---\n\n";
    md +=
      "📋 **AI Agent prompt available at:** `.guardrail/ai-fix-prompt.md`\n";

    fs.writeFileSync(fixesMdPath, md);
    console.log(
      `  ${c.green}✓${c.reset} Created ${c.cyan}.guardrail/fixes.md${c.reset} with detailed instructions`,
    );

    // 4. Generate AI agent prompt
    let aiPrompt = "# AI Agent Fix Prompt\n\n";
    aiPrompt +=
      "> Copy this entire prompt to an AI coding assistant to fix these issues safely.\n\n";
    aiPrompt += "---\n\n";
    aiPrompt += "## Task\n\n";
    aiPrompt +=
      "Fix the following production security and code quality issues. ";
    aiPrompt +=
      "Follow the exact instructions for each fix. Do NOT break existing functionality.\n\n";

    aiPrompt += "## Critical Rules\n\n";
    aiPrompt += "1. **Never delete code** - only modify or comment out\n";
    aiPrompt += "2. **Never change function signatures** - keep APIs stable\n";
    aiPrompt += "3. **Test after each fix** - ensure the app still runs\n";
    aiPrompt +=
      "4. **Preserve comments** - don't remove existing documentation\n";
    aiPrompt += "5. **Use environment variables** - never hardcode secrets\n\n";

    aiPrompt += "## Fixes Required\n\n";

    let fixNum = 1;
    for (const [category, problems] of Object.entries(byCategory)) {
      for (const p of problems) {
        aiPrompt += `### Fix ${fixNum}: ${category}\n\n`;
        aiPrompt += `**File:** \`${p.file}\`\n\n`;
        aiPrompt += `**Problem:** ${p.message}\n\n`;

        if (p._contextKey && fileContexts[p._contextKey]) {
          aiPrompt +=
            "**Current code (around line " +
            fileContexts[p._contextKey].line +
            "):**\n```\n";
          aiPrompt += fileContexts[p._contextKey].snippet;
          aiPrompt += "\n```\n\n";
        }

        aiPrompt += "**Action:**\n";

        if (p.fixAction === "move-to-env") {
          const varName = p.type.toUpperCase().replace(/[^A-Z0-9]/g, "_");
          aiPrompt += `1. Find the hardcoded ${p.type} in this file\n`;
          aiPrompt += `2. Replace the hardcoded value with \`process.env.${varName}\`\n`;
          aiPrompt += `3. Add \`${varName}\` to \`.env.example\` if not present\n`;
          aiPrompt += `4. Ensure the code handles undefined env var gracefully\n\n`;
          aiPrompt += "**Example transformation:**\n```diff\n";
          aiPrompt += `- const secret = "${STRIPE_LIVE_PREFIX}xxxxx";\n`;
          aiPrompt += `+ const secret = process.env.${varName};\n`;
          aiPrompt += `+ if (!secret) throw new Error('${varName} is required');\n`;
          aiPrompt += "```\n\n";
        } else if (p.fixAction === "remove-mock") {
          aiPrompt +=
            "1. Check if this file is a test file (should be in __tests__, *.test.*, *.spec.*)\n";
          aiPrompt +=
            "2. If it's a test file, this is a FALSE POSITIVE - skip it\n";
          aiPrompt += "3. If it's production code, either:\n";
          aiPrompt += "   - Remove the mock import/code entirely, OR\n";
          aiPrompt +=
            '   - Wrap it in `if (process.env.NODE_ENV !== "production")`\n\n';
        } else if (p.fixAction === "add-auth-middleware") {
          aiPrompt += "1. Identify the route handler for this endpoint\n";
          aiPrompt += "2. Add authentication middleware before the handler\n";
          aiPrompt +=
            '3. Example: `router.get("/admin", authMiddleware, adminHandler)`\n\n';
        }

        fixNum++;
      }
    }

    aiPrompt += "## Verification\n\n";
    aiPrompt += "After applying fixes:\n";
    aiPrompt += "1. Run `npm run build` or `pnpm build` to check for errors\n";
    aiPrompt += "2. Run `guardrail ship` to verify all issues are resolved\n";
    aiPrompt += "3. Test the application manually to ensure it works\n";

    fs.writeFileSync(aiPromptPath, aiPrompt);
    console.log(
      `  ${c.green}✓${c.reset} Created ${c.cyan}.guardrail/ai-fix-prompt.md${c.reset} for AI agents`,
    );

    fixResults.fixesMdCreated = true;
  } catch (err) {
    fixResults.errors.push(`Failed to create fixes.md: ${err.message}`);
  }

  return fixResults;
}

function printFixResults(fixResults) {
  console.log("");
  if (fixResults.errors.length > 0) {
    for (const err of fixResults.errors) {
      console.log(`  ${c.red}⚠️ ${err}${c.reset}`);
    }
  }

  if (
    fixResults.envExampleCreated ||
    fixResults.gitignoreUpdated ||
    fixResults.fixesMdCreated
  ) {
    console.log(`\n  ${c.bold}${c.green}✅ Safe fixes applied!${c.reset}`);
    console.log(
      `  ${c.dim}Review the changes and follow instructions in .guardrail/fixes.md${c.reset}\n`,
    );
  }
}

module.exports = { runShip: withErrorHandling(runShip, "Ship check failed") };
