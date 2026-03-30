const fs = require("fs");
const path = require("path");

// Import from the built TypeScript package
const {
  IaCSecurityScanner,
  PIIDetector,
} = require("../../../../packages/compliance/dist/index.js");

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

async function runComplianceScan(projectPath) {
  const results = {
    iac: [],
    pii: [],
    summary: { score: 100, risk: "low" },
  };

  try {
    // Use the IaCSecurityScanner from TypeScript package
    const iacScanner = new IaCSecurityScanner();
    const projectId = "local-scan"; // Required parameter for the scanner
    const iacResult = await iacScanner.scan(projectPath, projectId);

    // Transform IaC findings to match expected format
    if (iacResult.findings) {
      results.iac = iacResult.findings.map((finding) => ({
        severity: finding.severity,
        title: finding.title,
        filePath: finding.filePath,
        recommendation: finding.recommendation,
        rule: finding.ruleId,
        category: finding.category,
        description: finding.description,
      }));
    }

    // Use the PIIDetector from TypeScript package
    const piiDetector = new PIIDetector();
    const piiResult = await piiDetector.detectPII(projectPath, projectId);

    // Transform PII findings to match expected format
    if (piiResult.findings) {
      results.pii = piiResult.findings.map((finding) => ({
        severity: finding.severity || "medium",
        category: finding.category,
        location: {
          file: finding.filePath,
          line: finding.line,
          column: finding.column,
        },
        value: finding.value,
        context: finding.context,
      }));
    }

    // Calculate score based on findings
    const criticalIssues = results.iac.filter(
      (f) => f.severity === "critical",
    ).length;
    const highIssues = results.iac.filter((f) => f.severity === "high").length;
    const mediumIssues = results.iac.filter(
      (f) => f.severity === "medium",
    ).length;
    const piiHighRisk = results.pii.filter(
      (f) => f.category === "SSN" || f.category === "Credit Card",
    ).length;

    // Score calculation: Critical -20, High -10, Medium -5, PII High Risk -10
    const deduction =
      criticalIssues * 20 +
      highIssues * 10 +
      mediumIssues * 5 +
      piiHighRisk * 10;
    results.summary.score = Math.max(0, 100 - deduction);
    results.summary.risk =
      results.summary.score < 50
        ? "high"
        : results.summary.score < 80
          ? "medium"
          : "low";
  } catch (e) {
    console.error("Compliance Bridge Error:", e.message);
    // Fallback to basic scanning if TypeScript classes fail
    console.warn("Falling back to basic compliance scanning...");

    try {
      const files = walkDir(projectPath);

      // Basic IaC checks
      const tfFiles = files.filter((f) => f.endsWith(".tf"));
      for (const f of tfFiles) {
        const content = fs.readFileSync(f, "utf8");
        if (
          content.includes('acl = "public-read"') ||
          content.includes('acl = "public-write"')
        ) {
          results.iac.push({
            severity: "high",
            title: "Public S3 bucket detected",
            filePath: path.relative(projectPath, f),
            recommendation: "Remove public ACL from S3 bucket",
            rule: "TF-S3-001",
          });
        }
      }

      // Basic PII checks
      const sourceFiles = files.filter((f) =>
        /\.(js|ts|tsx|jsx|json)$/.test(f),
      );
      const piiPatterns = [
        {
          regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
          category: "Credit Card",
        },
        { regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/, category: "SSN" },
        {
          regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
          category: "Email",
        },
      ];

      for (const f of sourceFiles) {
        const content = fs.readFileSync(f, "utf8");
        for (const pattern of piiPatterns) {
          if (pattern.regex.test(content)) {
            results.pii.push({
              severity: "medium",
              category: pattern.category,
              location: { file: path.relative(projectPath, f) },
            });
          }
        }
      }

      // Update score
      const issueCount = results.iac.length + results.pii.length;
      results.summary.score = Math.max(0, 100 - issueCount * 5);
      results.summary.risk =
        issueCount > 5 ? "high" : issueCount > 0 ? "medium" : "low";
    } catch (fallbackError) {
      console.error("Fallback scanning also failed:", fallbackError.message);
    }
  }

  return results;
}

module.exports = { runComplianceScan };
