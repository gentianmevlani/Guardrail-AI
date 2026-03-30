/**
 * Security Scanner Module
 * Scans context for secrets, vulnerabilities, and sensitive data
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  stripeSkLiveRegex24Scan,
  stripePkLiveRegex24Scan,
} = require("../lib/stripe-scan-patterns");

/**
 * Secret patterns to detect
 */
const SECRET_PATTERNS = [
  // API Keys
  { pattern: /AIza[0-9A-Za-z_-]{35}/, type: "Google API Key" },
  { pattern: /AKIA[0-9A-Z]{16}/, type: "AWS Access Key" },
  { pattern: /xoxb-[0-9]{10}-[0-9]{10}/, type: "Slack Bot Token" },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, type: "GitHub Personal Token" },
  { pattern: stripeSkLiveRegex24Scan(), type: "Stripe Live Key" },
  { pattern: stripePkLiveRegex24Scan(), type: "Stripe Publishable Key" },
  
  // Generic patterns
  { pattern: /['"]?API[_-]?KEY['"]?\s*[:=]\s*['"][^'"]{8,}['"]/, type: "API Key" },
  { pattern: /['"]?SECRET[_-]?KEY['"]?\s*[:=]\s*['"][^'"]{8,}['"]/, type: "Secret Key" },
  { pattern: /['"]?PASSWORD['"]?\s*[:=]\s*['"][^'"]{6,}['"]/, type: "Password" },
  { pattern: /['"]?TOKEN['"]?\s*[:=]\s*['"][^'"]{8,}['"]/, type: "Token" },
  { pattern: /['"]?PRIVATE[_-]?KEY['"]?\s*[:=]\s*['"][^'"]{16,}['"]/, type: "Private Key" },
  
  // Database URLs
  { pattern: /mongodb:\/\/[^:]+:[^@]+@/, type: "MongoDB URL" },
  { pattern: /postgres:\/\/[^:]+:[^@]+@/, type: "PostgreSQL URL" },
  { pattern: /mysql:\/\/[^:]+:[^@]+@/, type: "MySQL URL" },
  
  // JWT tokens
  { pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/, type: "JWT Token" },
];

/**
 * Vulnerability patterns
 */
const VULNERABILITY_PATTERNS = [
  // SQL Injection
  { pattern: /query\s*\(\s*['"]\s*\+.*\+\s*['"]/, type: "SQL Injection", severity: "high" },
  { pattern: /execute\s*\(\s*['"]\s*\+/, type: "SQL Injection", severity: "high" },
  
  // XSS
  { pattern: /dangerouslySetInnerHTML/, type: "XSS Risk", severity: "high" },
  { pattern: /innerHTML\s*=/, type: "XSS Risk", severity: "medium" },
  { pattern: /document\.write\s*\(/, type: "XSS Risk", severity: "high" },
  
  // Path Traversal
  { pattern: /\.\.\/\.\./, type: "Path Traversal", severity: "medium" },
  { pattern: /readFile\s*\(\s*.*\+/, type: "Path Traversal", severity: "high" },
  
  // Insecure Crypto
  { pattern: /md5\s*\(/, type: "Weak Hash", severity: "medium" },
  { pattern: /sha1\s*\(/, type: "Weak Hash", severity: "medium" },
  
  // Hardcoded credentials
  { pattern: /admin\s*:\s*['"]admin['"]/, type: "Hardcoded Credentials", severity: "high" },
  { pattern: /root\s*:\s*['"][^'"]{4,}['"]/, type: "Hardcoded Credentials", severity: "high" },
  
  // Debug code
  { pattern: /console\.log\s*\(\s*password/, type: "Password in Log", severity: "high" },
  { pattern: /console\.log\s*\(\s*token/, type: "Token in Log", severity: "high" },
];

/**
 * Find files recursively
 */
function findFiles(dir, extensions, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth || !fs.existsSync(dir)) return [];
  
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...findFiles(fullPath, extensions, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

/**
 * Scan file for secrets
 */
function scanForSecrets(content, filePath) {
  const secrets = [];
  const lines = content.split("\n");
  
  for (const pattern of SECRET_PATTERNS) {
    const matches = content.matchAll(new RegExp(pattern.pattern.source, 'g'));
    for (const match of matches) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      const line = lines[lineNum - 1];
      
      secrets.push({
        type: pattern.type,
        file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
        line: lineNum,
        content: line.trim(),
        severity: "critical",
      });
    }
  }
  
  return secrets;
}

/**
 * Scan file for vulnerabilities
 */
function scanForVulnerabilities(content, filePath) {
  const vulnerabilities = [];
  const lines = content.split("\n");
  
  for (const pattern of VULNERABILITY_PATTERNS) {
    const matches = content.matchAll(new RegExp(pattern.pattern.source, 'g'));
    for (const match of matches) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      const line = lines[lineNum - 1];
      
      vulnerabilities.push({
        type: pattern.type,
        file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
        line: lineNum,
        content: line.trim(),
        severity: pattern.severity || "medium",
        recommendation: getRecommendation(pattern.type),
      });
    }
  }
  
  return vulnerabilities;
}

/**
 * Get recommendation for vulnerability type
 */
function getRecommendation(type) {
  const recommendations = {
    "SQL Injection": "Use parameterized queries or prepared statements",
    "XSS Risk": "Sanitize user input and use textContent instead of innerHTML",
    "Path Traversal": "Validate and sanitize file paths, use path.join()",
    "Weak Hash": "Use stronger hashing algorithms like bcrypt or Argon2",
    "Hardcoded Credentials": "Use environment variables for credentials",
    "Password in Log": "Remove sensitive data from logs",
    "Token in Log": "Remove sensitive data from logs",
  };
  
  return recommendations[type] || "Review and fix the security issue";
}

/**
 * Scan project for security issues
 */
function scanProject(projectPath) {
  const files = findFiles(projectPath, [".ts", ".tsx", ".js", ".jsx", ".json", ".env*", ".yml", ".yaml"], 5);
  
  const results = {
    secrets: [],
    vulnerabilities: [],
    stats: {
      totalFiles: files.length,
      filesWithSecrets: 0,
      filesWithVulnerabilities: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
    },
    scanned: new Date().toISOString(),
  };
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(projectPath, file).replace(/\\/g, "/");
      
      // Skip certain files
      if (relativePath.includes("node_modules") || 
          relativePath.includes(".git") ||
          relativePath.includes("dist/") ||
          relativePath.includes("build/")) {
        continue;
      }
      
      const secrets = scanForSecrets(content, file);
      const vulnerabilities = scanForVulnerabilities(content, file);
      
      if (secrets.length > 0) {
        results.secrets.push(...secrets);
        results.stats.filesWithSecrets++;
      }
      
      if (vulnerabilities.length > 0) {
        results.vulnerabilities.push(...vulnerabilities);
        results.stats.filesWithVulnerabilities++;
      }
      
      // Count severity
      for (const issue of [...secrets, ...vulnerabilities]) {
        switch (issue.severity) {
          case "critical":
            results.stats.criticalIssues++;
            break;
          case "high":
            results.stats.highIssues++;
            break;
          case "medium":
            results.stats.mediumIssues++;
            break;
        }
      }
    } catch {}
  }
  
  return results;
}

/**
 * Generate security report
 */
function generateSecurityReport(results) {
  let report = `# Security Scan Report\n\n`;
  report += `Scanned: ${new Date(results.scanned).toLocaleString()}\n`;
  report += `Total Files: ${results.stats.totalFiles}\n\n`;
  
  // Summary
  report += `## Summary\n\n`;
  report += `- Files with Secrets: ${results.stats.filesWithSecrets}\n`;
  report += `- Files with Vulnerabilities: ${results.stats.filesWithVulnerabilities}\n`;
  report += `- Critical Issues: ${results.stats.criticalIssues}\n`;
  report += `- High Issues: ${results.stats.highIssues}\n`;
  report += `- Medium Issues: ${results.stats.mediumIssues}\n\n`;
  
  // Secrets
  if (results.secrets.length > 0) {
    report += `## 🔑 Secrets Found (${results.secrets.length})\n\n`;
    for (const secret of results.secrets) {
      report += `### ${secret.type} - ${secret.file}:${secret.line}\n`;
      report += `\`\`\`\n${secret.content}\n\`\`\`\n\n`;
    }
  }
  
  // Vulnerabilities
  if (results.vulnerabilities.length > 0) {
    report += `## 🚨 Vulnerabilities Found (${results.vulnerabilities.length})\n\n`;
    for (const vuln of results.vulnerabilities) {
      const icon = vuln.severity === "critical" ? "🔴" : 
                   vuln.severity === "high" ? "🟠" : "🟡";
      report += `### ${icon} ${vuln.type} - ${vuln.file}:${vuln.line}\n`;
      report += `**Severity:** ${vuln.severity}\n`;
      report += `**Recommendation:** ${vuln.recommendation}\n\n`;
      report += `\`\`\`\n${vuln.content}\n\`\`\`\n\n`;
    }
  }
  
  if (results.secrets.length === 0 && results.vulnerabilities.length === 0) {
    report += `## ✅ No Security Issues Found\n\n`;
    report += `Great job! No secrets or obvious vulnerabilities were detected.\n`;
  }
  
  return report;
}

/**
 * Filter content for safe AI consumption
 */
function filterForAI(content) {
  let filtered = content;
  
  // Remove detected secrets
  for (const pattern of SECRET_PATTERNS) {
    filtered = filtered.replace(pattern.pattern, "[REDACTED_SECRET]");
  }
  
  // Remove sensitive lines
  const lines = filtered.split("\n");
  const safeLines = lines.filter(line => {
    const lower = line.toLowerCase();
    return !lower.includes("password") &&
           !lower.includes("secret") &&
           !lower.includes("private_key") &&
           !lower.includes("api_key") &&
           !line.includes("console.log") &&
           !line.includes("debugger");
  });
  
  return safeLines.join("\n");
}

module.exports = {
  scanProject,
  generateSecurityReport,
  filterForAI,
  SECRET_PATTERNS,
  VULNERABILITY_PATTERNS,
};
