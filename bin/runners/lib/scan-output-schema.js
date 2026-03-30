/**
 * Scan Output Schema & Validation
 * 
 * Defines the stable contract for scan output in JSON mode.
 * Used by CI/CD systems and programmatic consumers.
 */

const SCHEMA_VERSION = "1.0.0";

/**
 * @typedef {Object} Finding
 * @property {string} id - Unique finding identifier
 * @property {string} type - Finding type (secret, stub, vulnerability, etc.)
 * @property {'critical'|'high'|'medium'|'low'|'info'} severity - Severity level
 * @property {string} message - Human-readable description
 * @property {string} [file] - File path where found
 * @property {number} [line] - Line number
 * @property {number} confidence - Confidence score 0-100
 * @property {string} [suggestedFix] - Remediation guidance
 * @property {boolean} blocksShip - Whether this blocks shipping
 */

/**
 * @typedef {Object} ScanResult
 * @property {string} schemaVersion - Schema version for compatibility
 * @property {boolean} success - Whether scan completed without errors
 * @property {'pass'|'fail'|'warn'} verdict - Overall verdict
 * @property {number} score - Health score 0-100
 * @property {Object} summary - Summary counts
 * @property {number} summary.total - Total findings
 * @property {number} summary.critical - Critical findings
 * @property {number} summary.high - High findings
 * @property {number} summary.medium - Medium findings
 * @property {number} summary.low - Low findings
 * @property {number} summary.blockers - Findings that block shipping
 * @property {Finding[]} findings - All findings
 * @property {Object} metadata - Scan metadata
 * @property {string} metadata.scanId - Unique scan ID
 * @property {string} metadata.timestamp - ISO timestamp
 * @property {number} metadata.duration - Duration in ms
 * @property {string} metadata.projectPath - Scanned path
 * @property {Object} [error] - Error details if failed
 * @property {string} error.message - Error message
 * @property {string} error.code - Error code
 */

/**
 * Confidence levels for different finding types
 */
const CONFIDENCE_LEVELS = {
  // High confidence - these are almost certainly issues
  AWS_KEY: 95,
  PRIVATE_KEY: 95,
  STRIPE_LIVE_KEY: 95,
  GITHUB_TOKEN: 90,
  DATABASE_URL: 90,
  
  // Medium-high confidence - very likely issues
  GENERIC_API_KEY: 75,
  JWT_TOKEN: 70,
  BEARER_TOKEN: 70,
  HARDCODED_PASSWORD: 70,
  
  // Medium confidence - review recommended
  TODO_COMMENT: 50,
  MOCK_DATA: 60,
  PLACEHOLDER: 65,
  LOREM_IPSUM: 80,
  
  // Lower confidence - context-dependent
  LOCALHOST_URL: 40,
  TEST_EMAIL: 35,
  CONSOLE_LOG: 30,
};

/**
 * Determine if a finding should block shipping
 * Based on severity and confidence
 */
function isBlocker(finding) {
  // Critical findings block only if confidence > 80% (hardened threshold)
  if (finding.severity === 'critical' && finding.confidence > 80) {
    return true;
  }
  
  // High findings block only if confidence > 90% (hardened threshold)
  if (finding.severity === 'high' && finding.confidence > 90) {
    return true;
  }
  
  // Secrets always block in ship mode (high confidence by nature)
  if (finding.type?.includes('secret') || finding.type?.includes('key')) {
    return true;
  }
  
  return false;
}

/**
 * Get confidence score for a finding type
 */
function getConfidenceScore(type, context = {}) {
  const baseConfidence = CONFIDENCE_LEVELS[type] || 50;
  
  // Adjust based on context
  let adjusted = baseConfidence;
  
  // Lower confidence if in test/fixture file
  if (context.isTestFile) {
    adjusted = Math.max(10, adjusted - 30);
  }
  
  // Higher confidence if in source file
  if (context.isSourceFile) {
    adjusted = Math.min(100, adjusted + 10);
  }
  
  // Lower confidence for commented code
  if (context.inComment) {
    adjusted = Math.max(10, adjusted - 20);
  }
  
  return Math.round(adjusted);
}

/**
 * Calculate overall verdict from findings
 * Uses hardened blocker logic - only high-confidence findings block
 * SECURITY: High-confidence critical/high findings always block, even if blocksShip is explicitly false
 */
function calculateVerdict(findings) {
  if (!findings || findings.length === 0) {
    return 'pass';
  }
  
  // Apply hardened blocker logic - high-confidence critical/high findings always block
  const blockers = findings.filter(f => {
    // If explicitly marked as blocker, respect it
    if (f.blocksShip === true) return true;
    
    // Apply hardened thresholds: critical > 80%, high > 90%
    if (f.severity === 'critical' && f.confidence > 80) return true;
    if (f.severity === 'high' && f.confidence > 90) return true;
    
    // Secrets always block
    if (f.type?.includes('secret') || f.type?.includes('key')) return true;
    
    return false;
  });
  
  // Any blockers = fail
  if (blockers.length > 0) {
    return 'fail';
  }
  
  // Any critical, high, or medium findings = warn (but don't block if confidence too low)
  const criticals = findings.filter(f => f.severity === 'critical');
  const highs = findings.filter(f => f.severity === 'high');
  const mediums = findings.filter(f => f.severity === 'medium');
  if (criticals.length > 0 || highs.length > 0 || mediums.length > 0) {
    return 'warn';
  }
  
  // Only low/info findings = pass
  return 'pass';
}

/**
 * Calculate health score from findings
 */
function calculateScore(findings) {
  let score = 100;
  
  for (const finding of findings) {
    const weight = {
      critical: 25,
      high: 15,
      medium: 5,
      low: 2,
      info: 0,
    }[finding.severity] || 0;
    
    // Weight by confidence
    const adjustedWeight = weight * (finding.confidence / 100);
    score -= adjustedWeight;
  }
  
  return Math.max(0, Math.round(score));
}

/**
 * Deduplicate findings by unique key
 */
function dedupeFindings(findings) {
  const seen = new Map();
  
  for (const finding of findings) {
    // Create unique key based on type, file, line, and message
    const key = `${finding.type}:${finding.file || ''}:${finding.line || ''}:${finding.message?.slice(0, 50) || ''}`;
    
    if (!seen.has(key)) {
      seen.set(key, finding);
    } else {
      // Keep the higher severity/confidence one
      const existing = seen.get(key);
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
      
      if (severityOrder[finding.severity] > severityOrder[existing.severity] ||
          (severityOrder[finding.severity] === severityOrder[existing.severity] && 
           finding.confidence > existing.confidence)) {
        seen.set(key, finding);
      }
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Sort findings by shipping impact (blockers first, then by severity/confidence)
 * This ensures users see the most critical issues that block shipping first.
 */
function sortFindings(findings) {
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  
  return [...findings].sort((a, b) => {
    // 1. Blockers first (most important - these block shipping)
    const aIsBlocker = a.blocksShip === true;
    const bIsBlocker = b.blocksShip === true;
    if (aIsBlocker !== bIsBlocker) {
      return aIsBlocker ? -1 : 1;
    }
    
    // 2. Then by severity (critical > high > medium > low > info)
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    
    // 3. Then by confidence (higher confidence = more important)
    return b.confidence - a.confidence;
  });
}

/**
 * Create a valid scan result object
 */
function createScanResult(options) {
  const {
    findings = [],
    projectPath = process.cwd(),
    scanId = `scan_${Date.now()}`,
    startTime = Date.now(),
    error = null,
  } = options;

  // Process findings
  const processedFindings = findings.map(f => ({
    ...f,
    confidence: f.confidence || getConfidenceScore(f.type),
    blocksShip: f.blocksShip ?? isBlocker(f),
  }));

  const dedupedFindings = dedupeFindings(processedFindings);
  const sortedFindings = sortFindings(dedupedFindings);
  
  const summary = {
    total: sortedFindings.length,
    critical: sortedFindings.filter(f => f.severity === 'critical').length,
    high: sortedFindings.filter(f => f.severity === 'high').length,
    medium: sortedFindings.filter(f => f.severity === 'medium').length,
    low: sortedFindings.filter(f => f.severity === 'low').length,
    blockers: sortedFindings.filter(f => f.blocksShip).length,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    success: !error,
    verdict: error ? 'fail' : calculateVerdict(sortedFindings),
    score: calculateScore(sortedFindings),
    summary,
    findings: sortedFindings,
    metadata: {
      scanId,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      projectPath,
      version: require('../../../package.json').version,
    },
    ...(error ? { error: { message: error.message, code: error.code || 'SCAN_ERROR' } } : {}),
  };
}

/**
 * Validate a scan result against the schema
 */
function validateScanResult(result) {
  const errors = [];

  if (!result.schemaVersion) {
    errors.push("Missing schemaVersion");
  }
  
  if (typeof result.success !== 'boolean') {
    errors.push("Invalid or missing success field");
  }
  
  if (!['pass', 'fail', 'warn'].includes(result.verdict)) {
    errors.push(`Invalid verdict: ${result.verdict}`);
  }
  
  if (typeof result.score !== 'number' || result.score < 0 || result.score > 100) {
    errors.push(`Invalid score: ${result.score}`);
  }
  
  if (!result.summary || typeof result.summary.total !== 'number') {
    errors.push("Invalid or missing summary");
  }
  
  if (!Array.isArray(result.findings)) {
    errors.push("Findings must be an array");
  }
  
  if (!result.metadata?.scanId || !result.metadata?.timestamp) {
    errors.push("Missing required metadata fields");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  SCHEMA_VERSION,
  CONFIDENCE_LEVELS,
  isBlocker,
  getConfidenceScore,
  calculateVerdict,
  calculateScore,
  dedupeFindings,
  sortFindings,
  createScanResult,
  validateScanResult,
};
