const fs = require("fs");
const path = require("path");
const https = require("https");

// Cache for package existence checks
const packageCache = new Map();

/**
 * Check if a package exists in the NPM registry
 */
function checkNpmPackage(name) {
  return new Promise((resolve) => {
    if (packageCache.has(name)) return resolve(packageCache.get(name));

    // Handle scoped packages and regular packages
    const url = `https://registry.npmjs.org/${name}`;

    const req = https.request(url, { method: "HEAD" }, (res) => {
      const exists = res.statusCode === 200;
      packageCache.set(name, exists);
      resolve(exists);
    });

    req.on("error", () => resolve(false)); // Assume false on error or offline
    req.end();
  });
}

/**
 * Extract imports from file content
 */
function extractImports(content) {
  const imports = new Set();

  // ESM imports
  const importMatches = content.matchAll(
    /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g,
  );
  for (const match of importMatches) {
    if (match[1] && !match[1].startsWith(".") && !match[1].startsWith("/")) {
      // Extract package name (handle scoped packages)
      const parts = match[1].split("/");
      const pkgName = match[1].startsWith("@")
        ? `${parts[0]}/${parts[1]}`
        : parts[0];
      imports.add(pkgName);
    }
  }

  // CommonJS requires
  const requireMatches = content.matchAll(
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  );
  for (const match of requireMatches) {
    if (match[1] && !match[1].startsWith(".") && !match[1].startsWith("/")) {
      const parts = match[1].split("/");
      const pkgName = match[1].startsWith("@")
        ? `${parts[0]}/${parts[1]}`
        : parts[0];
      imports.add(pkgName);
    }
  }

  return Array.from(imports);
}

/**
 * Walk directory to find source files
 */
function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (
      ["node_modules", ".git", "dist", "build", ".guardrail", ".next"].includes(
        file,
      )
    )
      continue;

    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDir(filePath, fileList);
      } else if (/\.(ts|js|tsx|jsx)$/.test(file) && !file.endsWith(".d.ts")) {
        fileList.push(filePath);
      }
    } catch (e) {}
  }
  return fileList;
}

async function runHallucinationCheck(projectPath) {
  const issues = [];
  let score = 100;

  try {
    // 1. Check package.json dependencies
    const pkgPath = path.join(projectPath, "package.json");
    if (fs.existsSync(pkgPath)) {
      const content = fs.readFileSync(pkgPath, "utf8");
      if (content.trim()) {
        try {
          const pkg = JSON.parse(content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };

          // Limit checks to avoid rate limiting
          const depNames = Object.keys(deps).slice(0, 20);

          for (const dep of depNames) {
            // Skip internal/scoped packages for now if they look private
            if (dep.startsWith("@guardrail") || dep.startsWith("@internal"))
              continue;

            const exists = await checkNpmPackage(dep);
            if (!exists) {
              issues.push({
                severity: "critical",
                type: "Hallucination",
                message: `Dependency '${dep}' listed in package.json does not exist in public npm registry`,
                file: "package.json",
              });
            }
          }
        } catch (e) {
          console.warn("Failed to parse package.json:", e.message);
        }
      }
    }

    // 2. Scan source files for imports (if scanning a full project)
    // For specific file validation in runValidate, we might want to check that specific file's imports too.
    // However, runHallucinationCheck here is designed for project-level scanning.
  } catch (err) {
    console.error("AI Bridge Error:", err.message);
  }

  // Deduct score
  if (issues.length > 0) {
    score = Math.max(0, 100 - issues.length * 20);
  }

  return {
    score,
    issues,
  };
}

// --- Intent Matcher Logic (Ported from packages/ai-guardrails) ---

function extractCodeIntent(code) {
  const entities = [];
  const operations = [];

  // Extract function/class names
  const functionMatches = code.matchAll(
    /(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
  );
  for (const match of functionMatches) {
    if (match[1]) entities.push(match[1]);
  }

  const classMatches = code.matchAll(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
  for (const match of classMatches) {
    if (match[1]) entities.push(match[1]);
  }

  // Detect operations
  if (code.includes("fetch") || code.includes("axios") || code.includes("http"))
    operations.push("API call");
  if (
    code.includes("fs.") ||
    code.includes("writeFile") ||
    code.includes("readFile")
  )
    operations.push("File I/O");
  if (
    code.includes("database") ||
    code.includes("prisma") ||
    code.includes("mongoose")
  )
    operations.push("Database operation");
  if (
    code.includes("map") ||
    code.includes("filter") ||
    code.includes("reduce")
  )
    operations.push("Data transformation");
  if (code.includes("useState") || code.includes("useEffect"))
    operations.push("React hooks");

  return { entities, operations };
}

function parseRequestIntent(request) {
  const lowerRequest = request.toLowerCase();

  // Extract goal (simplified)
  let goal = "Unknown";
  if (lowerRequest.includes("create") || lowerRequest.includes("build"))
    goal = "Create new functionality";
  else if (lowerRequest.includes("fix") || lowerRequest.includes("debug"))
    goal = "Fix issue";

  // Extract constraints
  const constraints = [];
  if (lowerRequest.includes("without")) {
    const match = lowerRequest.match(/without\s+([^.,;]+)/);
    if (match) constraints.push(`Avoid: ${match[1].trim()}`);
  }
  if (lowerRequest.includes("using")) {
    const match = lowerRequest.match(/using\s+([^.,;]+)/);
    if (match) constraints.push(`Use: ${match[1].trim()}`);
  }

  // Extract expected entities
  const expectedEntities = [];
  const commonFrameworks = [
    "react",
    "vue",
    "angular",
    "express",
    "fastify",
    "next",
    "prisma",
    "postgres",
    "mongo",
  ];
  for (const fw of commonFrameworks) {
    if (lowerRequest.includes(fw)) expectedEntities.push(fw);
  }

  // Extract expected operations
  const expectedOperations = [];
  if (lowerRequest.includes("api") || lowerRequest.includes("fetch"))
    expectedOperations.push("API call");
  if (lowerRequest.includes("database") || lowerRequest.includes("store"))
    expectedOperations.push("Database operation");
  if (lowerRequest.includes("file")) expectedOperations.push("File I/O");

  return { goal, constraints, expectedEntities, expectedOperations };
}

function compareIntents(requested, actual) {
  const matches = [];
  const mismatches = [];
  let score = 0;

  // Check expected entities
  for (const expected of requested.expectedEntities) {
    const found =
      actual.entities.some((e) =>
        e.toLowerCase().includes(expected.toLowerCase()),
      ) ||
      // Also check imports for entities (e.g. react)
      actual.entities.some((e) =>
        e.toLowerCase().includes(expected.toLowerCase()),
      );

    if (found) {
      matches.push(`Expected entity '${expected}' found`);
      score += 20;
    } else {
      mismatches.push(`Expected entity '${expected}' not found in structure`);
    }
  }

  // Check expected operations
  for (const expectedOp of requested.expectedOperations) {
    const found = actual.operations.some((o) =>
      o.toLowerCase().includes(expectedOp.toLowerCase()),
    );
    if (found) {
      matches.push(`Expected operation '${expectedOp}' found`);
      score += 20;
    } else {
      mismatches.push(`Expected operation '${expectedOp}' not found`);
    }
  }

  // Check constraints
  for (const constraint of requested.constraints) {
    if (constraint.startsWith("Avoid:")) {
      const toAvoid = constraint.replace("Avoid:", "").trim().toLowerCase();
      const found = actual.entities.some((e) =>
        e.toLowerCase().includes(toAvoid),
      );
      if (!found) {
        matches.push(`Successfully avoided '${toAvoid}'`);
        score += 10;
      } else {
        mismatches.push(`Constraint violated: used '${toAvoid}'`);
        score -= 20;
      }
    }
    if (constraint.startsWith("Use:")) {
      const toUse = constraint.replace("Use:", "").trim().toLowerCase();
      const found = actual.entities.some((e) =>
        e.toLowerCase().includes(toUse),
      );
      if (found) {
        matches.push(`Required technology '${toUse}' used`);
        score += 15;
      } else {
        mismatches.push(`Required technology '${toUse}' not used`);
        score -= 15;
      }
    }
  }

  // Baseline score if nothing specific requested but code looks structured
  if (
    requested.expectedEntities.length === 0 &&
    requested.expectedOperations.length === 0 &&
    requested.constraints.length === 0
  ) {
    // If request is generic, and we found SOME entities, give it a pass
    if (actual.entities.length > 0) score = 100;
    else score = 50;
  }

  return {
    alignmentScore: Math.max(0, Math.min(100, score)),
    matches,
    mismatches,
  };
}

/**
 * Validate code against an intent
 */
function validateIntent(code, intent) {
  const issues = [];

  if (!intent) return { score: 100, issues: [] };

  const codeIntent = extractCodeIntent(code);
  const requestIntent = parseRequestIntent(intent);

  // Supplement codeIntent entities with imports for better matching (Bridge enhancement)
  const imports = extractImports(code);
  codeIntent.entities.push(...imports);

  const comparison = compareIntents(requestIntent, codeIntent);

  if (comparison.alignmentScore < 60) {
    issues.push({
      severity: "medium",
      type: "Intent Mismatch",
      message: `Code alignment score: ${comparison.alignmentScore}/100. ${comparison.mismatches.join(", ")}`,
      file: "generated-code",
    });
  }

  return {
    score: comparison.alignmentScore,
    issues,
  };
}

/**
 * Static Analysis/Quality Check
 */
function validateQuality(code) {
  const issues = [];
  let score = 100;

  // Check for hardcoded secrets
  if (
    /['"][a-zA-Z0-9]{20,}['"]/.test(code) &&
    (code.includes("key") || code.includes("token") || code.includes("secret"))
  ) {
    issues.push({
      severity: "high",
      type: "Security",
      message: "Potential hardcoded secret detected",
      file: "generated-code",
    });
  }

  // Check for syntax errors (basic)
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    issues.push({
      severity: "critical",
      type: "Syntax",
      message: "Unbalanced braces detected",
      file: "generated-code",
    });
  }

  // Check for console.log
  if (code.includes("console.log")) {
    issues.push({
      severity: "low",
      type: "Quality",
      message: "Console.log statement detected",
      file: "generated-code",
    });
    score -= 5;
  }

  return {
    score: Math.max(0, Math.min(100, score - issues.length * 10)),
    issues,
  };
}

module.exports = {
  runHallucinationCheck,
  validateIntent,
  validateQuality,
};
