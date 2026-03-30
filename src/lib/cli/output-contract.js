"use strict";
/**
 * CLI Output Contract
 *
 * Defines the stable, deterministic output format for all guardrail commands.
 * This is the "contract" that makes guardrail feel enterprise-grade.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXIT_CODES = void 0;
exports.generateFindingID = generateFindingID;
exports.normalizeFinding = normalizeFinding;
exports.sortFindings = sortFindings;
exports.buildVerdictOutput = buildVerdictOutput;
exports.formatStandardOutput = formatStandardOutput;
exports.EXIT_CODES = {
    PASS: 0,
    FAIL: 1, // Blockers found
    MISCONFIG: 2, // Missing env/deps/config
    INTERNAL: 3, // Bug in guardrail
};
/**
 * Generate stable finding ID
 */
function generateFindingID(category, index, existingIDs = new Set()) {
    const prefix = `GR-${category.toUpperCase()}`;
    let number = index + 1;
    let full = `${prefix}-${String(number).padStart(3, '0')}`;
    // Ensure uniqueness
    while (existingIDs.has(full)) {
        number++;
        full = `${prefix}-${String(number).padStart(3, '0')}`;
    }
    existingIDs.add(full);
    return {
        prefix,
        number,
        full,
    };
}
/**
 * Normalize finding to standard format
 */
function normalizeFinding(finding, category, index, existingIDs) {
    const id = generateFindingID(category, index, existingIDs);
    return {
        id,
        ruleId: finding.ruleId || finding.type || 'unknown',
        ruleName: finding.ruleName || finding.title || 'Unknown Rule',
        severity: finding.severity || 'medium',
        verdict: finding.verdict === 'FAIL' ? 'FAIL' : finding.verdict === 'WARN' ? 'WARN' : 'PASS',
        evidenceLevel: finding.evidenceLevel || 'lexical',
        confidence: finding.confidence || 0.5,
        file: finding.file || '',
        line: finding.line || 0,
        column: finding.column,
        endLine: finding.endLine,
        endColumn: finding.endColumn,
        message: finding.message || finding.description || '',
        codeSnippet: finding.codeSnippet || finding.snippet || '',
        evidence: (finding.evidence || []).map((e) => ({
            type: e.type || 'lexical',
            description: e.description || '',
            file: e.file,
            line: e.line,
            code: e.code,
            strength: e.strength || (e.type === 'runtime' ? 0.95 : e.type === 'structural' ? 0.7 : 0.3),
            metadata: e.metadata,
        })),
        reachable: finding.reachable ?? true,
        inProdPath: finding.inProdPath ?? true,
        score: finding.score || 0,
        fixSuggestion: finding.fixSuggestion || finding.suggestion || 'Review and fix',
        autofixAvailable: finding.autofixAvailable || false,
        verifyCommand: `guardrail replay ${finding.scanId || 'latest'} --id ${id.full}`,
        explainUrl: finding.explainUrl,
    };
}
/**
 * Sort findings deterministically
 */
function sortFindings(findings) {
    return [...findings].sort((a, b) => {
        // First by verdict (FAIL > WARN > PASS)
        const verdictOrder = { FAIL: 0, WARN: 1, PASS: 2, ERROR: 3 };
        const verdictDiff = verdictOrder[a.verdict] - verdictOrder[b.verdict];
        if (verdictDiff !== 0)
            return verdictDiff;
        // Then by severity
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0)
            return severityDiff;
        // Then by score (higher first)
        if (b.score !== a.score)
            return b.score - a.score;
        // Then by file path (alphabetical)
        if (a.file !== b.file)
            return a.file.localeCompare(b.file);
        // Then by line number
        return a.line - b.line;
    });
}
/**
 * Build verdict output
 */
function buildVerdictOutput(findings, timings, cached = false) {
    const sorted = sortFindings(findings);
    const blockers = sorted.filter(f => f.verdict === 'FAIL');
    const warnings = sorted.filter(f => f.verdict === 'WARN');
    const info = sorted.filter(f => f.verdict === 'PASS' && f.severity === 'info');
    const verdict = blockers.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';
    const exitCode = blockers.length > 0 ? exports.EXIT_CODES.FAIL : exports.EXIT_CODES.PASS;
    return {
        verdict,
        exitCode,
        summary: {
            totalFindings: findings.length,
            blockers: blockers.length,
            warnings: warnings.length,
            info: info.length,
        },
        topBlockers: blockers.slice(0, 3),
        warnings,
        info,
        timings,
        cached,
    };
}
/**
 * Format standard scan output
 */
function formatStandardOutput(verdict, findings, scanId, projectPath, metadata) {
    return {
        schemaVersion: '1.0.0',
        timestamp: new Date().toISOString(),
        scanId,
        projectPath,
        verdict,
        findings: sortFindings(findings),
        metadata: {
            ...metadata,
            cacheHit: verdict.cached,
        },
    };
}
