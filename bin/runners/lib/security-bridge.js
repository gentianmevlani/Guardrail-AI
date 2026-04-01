const fs = require("fs");
const path = require("path");

// Import from the built TypeScript packages
const {
  SecretsGuardian,
  SBOMGenerator,
  SupplyChainAnalyzer,
  LicenseChecker,
} = require("../../../../packages/security/dist/index.js");

function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (["node_modules", ".git", "dist", "build", ".guardrail"].includes(file))
      continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

async function runSecretsScan(projectPath) {
  const results = {
    secrets: [],
    supplyChain: [],
    licenses: [],
    summary: { score: 100, risk: "low" },
  };

  try {
    // Use SecretsGuardian from TypeScript package
    const secretsGuardian = new SecretsGuardian();
    const secretsResult = await secretsGuardian.scan(projectPath, {
      includeTestFiles: false,
      checkEntropy: true,
      checkRevoked: false, // Skip revoked check for local scans
    });

    // Transform secrets to match expected format
    if (secretsResult.detections) {
      results.secrets = secretsResult.detections.map((detection) => ({
        severity:
          detection.confidence > 0.8
            ? "high"
            : detection.confidence > 0.6
              ? "medium"
              : "low",
        type: detection.secretType,
        message: `${detection.secretType} detected`,
        file: path.relative(projectPath, detection.filePath),
        location: {
          line: detection.location.line,
          column: detection.location.column,
          snippet: detection.location.snippet,
        },
        maskedValue: detection.maskedValue,
        recommendation: detection.recommendation.remediation,
      }));
    }

    // Use SBOMGenerator for supply chain analysis
    const sbomGenerator = new SBOMGenerator();
    const sbomResult = await sbomGenerator.generate(projectPath, {
      format: "cyclonedx",
      includeDevDependencies: false,
    });

    // Check for supply chain issues
    if (sbomResult.dependencies) {
      const highRiskDeps = sbomResult.dependencies.filter(
        (dep) => dep.vulnerabilities && dep.vulnerabilities.length > 0,
      );

      if (highRiskDeps.length > 0) {
        results.supplyChain = highRiskDeps.map((dep) => ({
          severity: "high",
          type: "Vulnerability",
          message: `Dependency ${dep.name} has ${dep.vulnerabilities.length} vulnerabilities`,
          file: "package.json",
          component: dep.name,
          version: dep.version,
          vulnerabilities: dep.vulnerabilities,
        }));
      }
    }

    // Check lockfile consistency
    const hasNpmLock = fs.existsSync(
      path.join(projectPath, "package-lock.json"),
    );
    const hasPnpmLock = fs.existsSync(path.join(projectPath, "pnpm-lock.yaml"));
    const hasYarnLock = fs.existsSync(path.join(projectPath, "yarn.lock"));

    if (!hasNpmLock && !hasPnpmLock && !hasYarnLock) {
      results.supplyChain.push({
        severity: "medium",
        type: "Supply Chain",
        message:
          "No lockfile found. Builds may be non-deterministic and vulnerable to supply chain attacks.",
        file: "package.json",
      });
    }

    // Use LicenseChecker for license compliance
    const licenseChecker = new LicenseChecker();
    const licenseResult = await licenseChecker.check(projectPath, {
      allowLicenses: [
        "MIT",
        "Apache-2.0",
        "BSD-2-Clause",
        "BSD-3-Clause",
        "ISC",
      ],
      includeDevDependencies: false,
    });

    if (licenseResult.issues) {
      results.licenses = licenseResult.issues.map((issue) => ({
        severity: issue.severity || "medium",
        type: "License",
        message: `Package ${issue.package} has disallowed license: ${issue.license}`,
        file: "package.json",
        component: issue.package,
        license: issue.license,
      }));
    }

    // Calculate security score
    const criticalSecrets = results.secrets.filter(
      (s) => s.severity === "high",
    ).length;
    const vulnerabilities = results.supplyChain.filter(
      (s) => s.type === "Vulnerability",
    ).length;
    const licenseIssues = results.licenses.length;

    // Score deduction: Critical secrets -20, Vulnerabilities -15, License issues -10, Other issues -5
    const deduction =
      criticalSecrets * 20 + vulnerabilities * 15 + licenseIssues * 10;
    deduction +=
      (results.secrets.length - criticalSecrets) * 5 +
      results.supplyChain.filter((s) => s.type !== "Vulnerability").length * 5;

    results.summary.score = Math.max(0, 100 - deduction);
    results.summary.risk =
      results.summary.score < 50
        ? "high"
        : results.summary.score < 80
          ? "medium"
          : "low";
  } catch (e) {
    console.error("Security Bridge Error:", e.message);
    // Fallback to basic scanning if TypeScript classes fail
    console.warn("Falling back to basic security scanning...");

    try {
      const files = walkDir(projectPath);

      // Basic secrets detection
      const secretPatterns = [
        {
          regex: /['"]?API[_-]?KEY['"]?\s*[:=]\s*['"]([a-zA-Z0-9]{20,})['"]/,
          type: "API Key",
        },
        {
          regex: /['"]?PASSWORD['"]?\s*[:=]\s*['"]([^'"]{8,})['"]/,
          type: "Password",
        },
        {
          regex: /['"]?SECRET['"]?\s*[:=]\s*['"]([a-zA-Z0-9]{20,})['"]/,
          type: "Secret",
        },
        {
          regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
          type: "Private Key",
        },
      ];

      for (const file of files) {
        if (
          file.endsWith(".js") ||
          file.endsWith(".ts") ||
          file.endsWith(".json") ||
          file.endsWith(".env")
        ) {
          const content = fs.readFileSync(file, "utf8");
          for (const pattern of secretPatterns) {
            const matches = content.match(pattern.regex);
            if (matches) {
              results.secrets.push({
                severity: "high",
                type: pattern.type,
                message: `${pattern.type} detected`,
                file: path.relative(projectPath, file),
                recommendation:
                  "Move to environment variables or use a secret manager",
              });
            }
          }
        }
      }

      // Basic lockfile check
      const hasNpmLock = fs.existsSync(
        path.join(projectPath, "package-lock.json"),
      );
      const hasPnpmLock = fs.existsSync(
        path.join(projectPath, "pnpm-lock.yaml"),
      );
      const hasYarnLock = fs.existsSync(path.join(projectPath, "yarn.lock"));

      if (!hasNpmLock && !hasPnpmLock && !hasYarnLock) {
        results.supplyChain.push({
          severity: "medium",
          type: "Supply Chain",
          message:
            "No lockfile found. Builds may be non-deterministic and vulnerable to supply chain attacks.",
          file: "package.json",
        });
      }

      // Update score
      const issueCount =
        results.secrets.length +
        results.supplyChain.length +
        results.licenses.length;
      results.summary.score = Math.max(0, 100 - issueCount * 10);
      results.summary.risk =
        results.summary.score < 50
          ? "high"
          : results.summary.score < 80
            ? "medium"
            : "low";
    } catch (fallbackError) {
      console.error("Fallback scanning also failed:", fallbackError.message);
    }
  }

  return results;
}

module.exports = { runSecretsScan };
