import fs from "node:fs";
import path from "node:path";
import https from "node:https";

export type Vulnerability = {
  package: string;
  version: string;
  severity: "critical" | "high" | "moderate" | "low";
  title: string;
  url?: string;
  recommendation: string;
};

export type VulnerabilityReport = {
  vulnerabilities: Vulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  scannedAt: string;
};

// Known vulnerable packages (subset - in production, use npm audit or OSV API)
const KNOWN_VULNERABILITIES: Record<string, { below: string; severity: Vulnerability["severity"]; title: string; recommendation: string }[]> = {
  "lodash": [
    { below: "4.17.21", severity: "critical", title: "Prototype Pollution", recommendation: "Upgrade to lodash@4.17.21 or later" }
  ],
  "axios": [
    { below: "1.6.0", severity: "high", title: "SSRF vulnerability", recommendation: "Upgrade to axios@1.6.0 or later" }
  ],
  "jsonwebtoken": [
    { below: "9.0.0", severity: "critical", title: "Algorithm confusion attack", recommendation: "Upgrade to jsonwebtoken@9.0.0 or later" }
  ],
  "express": [
    { below: "4.19.2", severity: "moderate", title: "Open redirect vulnerability", recommendation: "Upgrade to express@4.19.2 or later" }
  ],
  "next": [
    { below: "14.1.1", severity: "high", title: "Server-side request forgery", recommendation: "Upgrade to next@14.1.1 or later" }
  ],
  "react-scripts": [
    { below: "5.0.0", severity: "moderate", title: "Multiple vulnerabilities in dependencies", recommendation: "Upgrade to react-scripts@5.0.0 or later" }
  ],
  "minimist": [
    { below: "1.2.6", severity: "critical", title: "Prototype Pollution", recommendation: "Upgrade to minimist@1.2.6 or later" }
  ],
  "node-fetch": [
    { below: "2.6.7", severity: "high", title: "Exposure of sensitive information", recommendation: "Upgrade to node-fetch@2.6.7 or later" }
  ],
  "tar": [
    { below: "6.2.1", severity: "high", title: "Arbitrary file creation/overwrite", recommendation: "Upgrade to tar@6.2.1 or later" }
  ],
  "semver": [
    { below: "7.5.2", severity: "moderate", title: "ReDoS vulnerability", recommendation: "Upgrade to semver@7.5.2 or later" }
  ],
};

export async function scanVulnerabilities(repoRoot: string): Promise<VulnerabilityReport> {
  const vulnerabilities: Vulnerability[] = [];
  const pkgPath = path.join(repoRoot, "package.json");
  
  if (!fs.existsSync(pkgPath)) {
    return {
      vulnerabilities: [],
      summary: { total: 0, critical: 0, high: 0, moderate: 0, low: 0 },
      scannedAt: new Date().toISOString()
    };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  for (const [name, versionSpec] of Object.entries(allDeps)) {
    const version = parseVersion(versionSpec as string);
    const knownVulns = KNOWN_VULNERABILITIES[name];
    
    if (knownVulns) {
      for (const vuln of knownVulns) {
        if (isVersionBelow(version, vuln.below)) {
          vulnerabilities.push({
            package: name,
            version: version,
            severity: vuln.severity,
            title: vuln.title,
            recommendation: vuln.recommendation
          });
        }
      }
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
  vulnerabilities.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    vulnerabilities,
    summary: {
      total: vulnerabilities.length,
      critical: vulnerabilities.filter(v => v.severity === "critical").length,
      high: vulnerabilities.filter(v => v.severity === "high").length,
      moderate: vulnerabilities.filter(v => v.severity === "moderate").length,
      low: vulnerabilities.filter(v => v.severity === "low").length,
    },
    scannedAt: new Date().toISOString()
  };
}

function parseVersion(spec: string): string {
  // Remove ^, ~, >=, etc.
  return spec.replace(/^[\^~>=<]+/, "").split(" ")[0];
}

function isVersionBelow(current: string, target: string): boolean {
  const currentParts = current.split(".").map(Number);
  const targetParts = target.split(".").map(Number);
  
  for (let i = 0; i < Math.max(currentParts.length, targetParts.length); i++) {
    const c = currentParts[i] || 0;
    const t = targetParts[i] || 0;
    if (c < t) return true;
    if (c > t) return false;
  }
  return false;
}

export async function checkPackageVulnerability(
  repoRoot: string,
  packageName: string
): Promise<{ vulnerable: boolean; vulnerabilities: Vulnerability[] }> {
  const report = await scanVulnerabilities(repoRoot);
  const vulns = report.vulnerabilities.filter(v => v.package === packageName);
  
  return {
    vulnerable: vulns.length > 0,
    vulnerabilities: vulns
  };
}
