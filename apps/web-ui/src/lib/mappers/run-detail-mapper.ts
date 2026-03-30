/**
 * Mappers for transforming RunDetail data into formats needed by UI components
 */

import type {
  RunDetail,
  RunDetailFinding,
} from "@/lib/api";

export interface FileWithStats {
  path: string;
  score: number;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  confidence: number;
  lastModified?: string;
}

export interface FindingWithConfidence extends RunDetailFinding {
  confidence: number;
  confidenceSource: "api" | "derived";
}

/**
 * Derives confidence score from finding data when not available from API
 * Uses rule-based heuristics based on severity, rule type, and fixability
 */
function deriveConfidence(finding: RunDetailFinding): number {
  // Base confidence from severity
  const severityMap: Record<string, number> = {
    critical: 0.95,
    high: 0.85,
    medium: 0.65,
    low: 0.45,
  };
  let confidence = severityMap[finding.severity] || 0.5;

  // Adjust based on rule type patterns
  const rule = finding.rule.toLowerCase();
  if (rule.includes("secret") || rule.includes("password") || rule.includes("api_key")) {
    confidence = Math.min(confidence + 0.1, 1.0);
  } else if (rule.includes("mock") || rule.includes("test") || rule.includes("placeholder")) {
    confidence = Math.max(confidence - 0.1, 0.3);
  }

  // Fixable findings are often more certain
  if (finding.fixable) {
    confidence = Math.min(confidence + 0.05, 1.0);
  }

  // Round to 2 decimal places
  return Math.round(confidence * 100) / 100;
}

/**
 * Transforms findings to include confidence scores
 * Uses API confidence if available, otherwise derives it consistently
 */
export function mapFindingsWithConfidence(
  findings: RunDetailFinding[],
): FindingWithConfidence[] {
  return findings.map((finding) => {
    // Check if confidence is available in the finding (if API adds it later)
    // Type assertion needed because RunDetailFinding doesn't include confidence yet
    const apiConfidence = (finding as any).confidence as number | undefined;
    
    if (apiConfidence !== undefined && typeof apiConfidence === "number" && apiConfidence >= 0 && apiConfidence <= 1) {
      return {
        ...finding,
        confidence: Math.round(apiConfidence * 100) / 100,
        confidenceSource: "api" as const,
      };
    }
    
    // Derive confidence if not available from API
    const confidence = deriveConfidence(finding);
    return {
      ...finding,
      confidence,
      confidenceSource: "derived" as const,
    };
  });
}

/**
 * Groups findings by file and calculates file-level statistics
 */
export function mapFilesWithStats(
  findings: RunDetailFinding[],
): FileWithStats[] {
  const fileMap = new Map<string, FileWithStats>();

  findings.forEach((finding) => {
    const filePath = finding.file;
    if (!fileMap.has(filePath)) {
      fileMap.set(filePath, {
        path: filePath,
        score: 100, // Start at 100, deduct for findings
        findingsCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        confidence: 0,
      });
    }

    const fileStats = fileMap.get(filePath)!;
    fileStats.findingsCount++;

    // Count by severity
    switch (finding.severity) {
      case "critical":
        fileStats.criticalCount++;
        fileStats.score -= 20;
        break;
      case "high":
        fileStats.highCount++;
        fileStats.score -= 10;
        break;
      case "medium":
        fileStats.mediumCount++;
        fileStats.score -= 5;
        break;
      case "low":
        fileStats.lowCount++;
        fileStats.score -= 2;
        break;
    }

    // Calculate average confidence for the file
    const confidence = deriveConfidence(finding);
    fileStats.confidence =
      (fileStats.confidence * (fileStats.findingsCount - 1) + confidence) /
      fileStats.findingsCount;
  });

  // Ensure score doesn't go below 0
  const files = Array.from(fileMap.values()).map((file) => ({
    ...file,
    score: Math.max(0, file.score),
    confidence: Math.round(file.confidence * 100) / 100,
  }));

  // Sort by score (lowest first - files with most issues)
  return files.sort((a, b) => a.score - b.score);
}

/**
 * Groups findings by fixability and rule type for Fix Packs
 */
export interface FixPack {
  id: string;
  rule: string;
  severity: RunDetailFinding["severity"];
  findings: FindingWithConfidence[];
  fixable: boolean;
  confidence: number;
  fileCount: number;
}

export function mapFindingsToFixPacks(
  findings: FindingWithConfidence[],
): FixPack[] {
  const packMap = new Map<string, FixPack>();

  findings.forEach((finding) => {
    const key = `${finding.rule}-${finding.severity}`;
    if (!packMap.has(key)) {
      packMap.set(key, {
        id: key,
        rule: finding.rule,
        severity: finding.severity,
        findings: [],
        fixable: finding.fixable,
        confidence: 0,
        fileCount: 0,
      });
    }

    const pack = packMap.get(key)!;
    pack.findings.push(finding);

    // Track unique files
    const uniqueFiles = new Set(pack.findings.map((f) => f.file));
    pack.fileCount = uniqueFiles.size;

    // Calculate average confidence
    pack.confidence =
      pack.findings.reduce((sum, f) => sum + f.confidence, 0) /
      pack.findings.length;
  });

  const packs = Array.from(packMap.values()).map((pack) => ({
    ...pack,
    confidence: Math.round(pack.confidence * 100) / 100,
  }));

  // Sort by severity (critical first) then by confidence
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return packs.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.confidence - a.confidence;
  });
}

/**
 * Runtime assertion to catch schema drift
 * Validates that RunDetail structure matches expected format
 */
export function validateRunDetailSchema(run: RunDetail | null): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!run) {
    return { valid: false, errors: ["Run detail is null"] };
  }

  // Required fields
  const requiredFields: (keyof RunDetail)[] = [
    "id",
    "timestamp",
    "repo",
    "branch",
    "commit",
    "verdict",
    "duration",
    "tools",
    "policyHash",
    "findings",
    "artifacts",
    "gates",
    "mockproofTraces",
    "airlockResults",
  ];

  for (const field of requiredFields) {
    if (!(field in run)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate findings structure
  if (run.findings && Array.isArray(run.findings)) {
    run.findings.forEach((finding, index) => {
      const findingFields: (keyof RunDetailFinding)[] = [
        "id",
        "severity",
        "rule",
        "message",
        "file",
        "line",
        "fixable",
      ];
      for (const field of findingFields) {
        if (!(field in finding)) {
          errors.push(`Finding ${index} missing field: ${field}`);
        }
      }
    });
  } else {
    errors.push("Findings must be an array");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
