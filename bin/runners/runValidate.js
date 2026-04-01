const fs = require("fs");
const path = require("path");
const {
  validateIntent,
  validateQuality,
  runHallucinationCheck,
} = require("./lib/ai-bridge");

function parseArgs(args) {
  const out = {
    file: null,
    intent: null,
    fix: false,
    projectPath: ".",
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--file=")) out.file = a.split("=")[1];
    if (a === "--file") out.file = args[++i];
    if (a.startsWith("--intent=")) out.intent = a.split("=")[1];
    if (a === "--intent") out.intent = args[++i];
    if (a === "--fix") out.fix = true;
    if (a.startsWith("--path=")) out.projectPath = a.split("=")[1];
  }

  // Positional arg 0 as file if not specified
  if (!out.file && args[0] && !args[0].startsWith("-")) {
    out.file = args[0];
  }

  return out;
}

async function runValidate(args) {
  const opts = parseArgs(args);
  console.log("\n  🤖 guardrail AI VALIDATOR\n");

  if (!opts.file) {
    console.error(
      "  ❌ Error: No file specified. Use --file=<path> or pass file path as argument.",
    );
    return 1;
  }

  const filePath = path.resolve(opts.projectPath, opts.file);
  if (!fs.existsSync(filePath)) {
    console.error(`  ❌ Error: File not found: ${filePath}`);
    return 1;
  }

  const code = fs.readFileSync(filePath, "utf8");
  const projectPath = path.resolve(opts.projectPath);

  console.log(`  Target: ${opts.file}`);
  if (opts.intent) console.log(`  Intent: "${opts.intent}"`);
  console.log("");

  // 1. Hallucination Check (Source level)
  console.log("  🔍 Checking for hallucinations...");
  const hallResult = await runHallucinationCheck(projectPath); // Checks project deps primarily
  // Note: runHallucinationCheck mainly checks deps. For a single file, we should arguably check its imports specifically.
  // The ai-bridge source scan covers files, but let's assume we want to validate THIS file specifically.
  // For now, the bridge scans project context. Let's rely on that + local quality.

  // 2. Intent Check
  let intentResult = { score: 100, issues: [] };
  if (opts.intent) {
    console.log("  🧠 Verifying intent alignment...");
    intentResult = validateIntent(code, opts.intent);
  }

  // 3. Quality/Security Check
  console.log("  🛡️  Validating code quality & security...");
  const qualityResult = validateQuality(code);

  // Aggregate
  const allIssues = [
    ...hallResult.issues,
    ...intentResult.issues,
    ...qualityResult.issues,
  ];

  const overallScore = Math.round(
    (hallResult.score + intentResult.score + qualityResult.score) / 3,
  );

  // Output
  console.log(`\n  ┌────────────────────────────────────────────┐`);
  console.log(
    `  │     VALIDATION SCORE: ${String(overallScore).padStart(3)}                  │`,
  );
  console.log(
    `  │     STATUS: ${overallScore >= 80 ? "✅ PASSED" : "⚠️ ISSUES FOUND"}               │`,
  );
  console.log(`  └────────────────────────────────────────────┘\n`);

  if (allIssues.length > 0) {
    console.log("  🚨 Issues Found:\n");
    for (const issue of allIssues) {
      const icon =
        issue.severity === "critical"
          ? "🔴"
          : issue.severity === "high"
            ? "🟠"
            : "🟡";
      console.log(`  ${icon} [${issue.type}] ${issue.message}`);
    }
    console.log("");
    return 1;
  } else {
    console.log("  ✨ Code looks good!\n");
    return 0;
  }
}

module.exports = { runValidate };
