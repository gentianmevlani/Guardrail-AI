"use strict";
/**
 * Fix Packs Generator
 *
 * Generates deterministic Fix Packs from findings and repo fingerprint.
 * Groups findings by category, file proximity, and risk level.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFixPacks = generateFixPacks;
exports.generateRepoFingerprint = generateRepoFingerprint;
exports.parseFindingsFromScanOutput = parseFindingsFromScanOutput;
const crypto = __importStar(require("crypto"));
const types_1 = require("./types");
// ============================================================================
// CONSTANTS
// ============================================================================
const DEFAULT_MAX_PACK_SIZE = 10;
const DEFAULT_MIN_PACK_SIZE = 1;
const FILE_PROXIMITY_THRESHOLD = 2;
const CATEGORY_PRIORITY = {
    secrets: 0,
    auth: 1,
    security: 2,
    routes: 3,
    mocks: 4,
    placeholders: 5,
    deps: 6,
    types: 7,
    tests: 8,
    performance: 9,
};
const CATEGORY_STRATEGY = {
    secrets: 'auto',
    auth: 'guided',
    security: 'guided',
    routes: 'auto',
    mocks: 'auto',
    placeholders: 'auto',
    deps: 'guided',
    types: 'ai-assisted',
    tests: 'ai-assisted',
    performance: 'manual',
};
const CATEGORY_REQUIRES_REVIEW = {
    secrets: false,
    auth: true,
    security: true,
    routes: false,
    mocks: false,
    placeholders: false,
    deps: true,
    types: false,
    tests: true,
    performance: true,
};
// ============================================================================
// MAIN GENERATOR
// ============================================================================
function generateFixPacks(options) {
    const { findings, repoFingerprint, groupByCategory = true, groupByFileProximity = true, maxPackSize = DEFAULT_MAX_PACK_SIZE, minPackSize = DEFAULT_MIN_PACK_SIZE, } = options;
    if (findings.length === 0) {
        return {
            packs: [],
            ungrouped: [],
            stats: {
                totalFindings: 0,
                totalPacks: 0,
                byCategory: {},
                bySeverity: {},
            },
        };
    }
    const sortedFindings = sortFindings(findings);
    let grouped;
    if (groupByCategory) {
        grouped = groupByCategories(sortedFindings);
    }
    else {
        grouped = new Map([['all', sortedFindings]]);
    }
    if (groupByFileProximity) {
        grouped = applyFileProximityGrouping(grouped, maxPackSize);
    }
    const packs = [];
    const ungrouped = [];
    let packIndex = 0;
    const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
        const catA = a[1][0]?.category || 'performance';
        const catB = b[1][0]?.category || 'performance';
        return CATEGORY_PRIORITY[catA] - CATEGORY_PRIORITY[catB];
    });
    for (const [, groupFindings] of sortedGroups) {
        if (groupFindings.length < minPackSize) {
            ungrouped.push(...groupFindings);
            continue;
        }
        const chunks = chunkFindings(groupFindings, maxPackSize);
        for (const chunk of chunks) {
            const pack = createFixPack(chunk, repoFingerprint, packIndex++);
            packs.push(pack);
        }
    }
    const stats = calculateStats(findings, packs);
    return {
        packs: sortPacksBySeverityAndPriority(packs),
        ungrouped,
        stats,
    };
}
// ============================================================================
// SORTING
// ============================================================================
function sortFindings(findings) {
    return [...findings].sort((a, b) => {
        const severityDiff = (0, types_1.compareSeverity)(a.severity, b.severity);
        if (severityDiff !== 0)
            return severityDiff;
        const categoryDiff = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
        if (categoryDiff !== 0)
            return categoryDiff;
        const fileDiff = a.file.localeCompare(b.file);
        if (fileDiff !== 0)
            return fileDiff;
        return (a.line || 0) - (b.line || 0);
    });
}
function sortPacksBySeverityAndPriority(packs) {
    return [...packs].sort((a, b) => {
        const severityDiff = (0, types_1.compareSeverity)(a.severity, b.severity);
        if (severityDiff !== 0)
            return severityDiff;
        return CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
    });
}
// ============================================================================
// GROUPING
// ============================================================================
function groupByCategories(findings) {
    const groups = new Map();
    for (const finding of findings) {
        const key = finding.category;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(finding);
    }
    return groups;
}
function applyFileProximityGrouping(groups, _maxPackSize) {
    const result = new Map();
    for (const [category, findings] of groups) {
        const fileGroups = new Map();
        for (const finding of findings) {
            const dirPath = getDirectoryPath(finding.file, FILE_PROXIMITY_THRESHOLD);
            if (!fileGroups.has(dirPath)) {
                fileGroups.set(dirPath, []);
            }
            fileGroups.get(dirPath).push(finding);
        }
        let subIndex = 0;
        for (const [dirPath, dirFindings] of fileGroups) {
            const key = `${category}:${dirPath}:${subIndex++}`;
            result.set(key, dirFindings);
        }
    }
    return result;
}
function getDirectoryPath(filePath, depth) {
    const parts = filePath.split(/[/\\]/);
    if (parts.length <= depth) {
        return parts.slice(0, -1).join('/') || '/';
    }
    return parts.slice(0, depth).join('/');
}
function chunkFindings(findings, maxSize) {
    const chunks = [];
    for (let i = 0; i < findings.length; i += maxSize) {
        chunks.push(findings.slice(i, i + maxSize));
    }
    return chunks;
}
// ============================================================================
// PACK CREATION
// ============================================================================
function createFixPack(findings, repoFingerprint, index) {
    const category = findings[0]?.category || 'security';
    const severities = findings.map(f => f.severity);
    const severity = (0, types_1.getHighestSeverity)(severities);
    const files = [...new Set(findings.map(f => f.file))];
    const packHash = generateDeterministicHash(findings, repoFingerprint);
    const id = (0, types_1.generatePackId)(category, index, packHash);
    const estimatedImpact = estimateImpact(findings, files);
    const strategy = CATEGORY_STRATEGY[category];
    const requiresHumanReview = CATEGORY_REQUIRES_REVIEW[category] ||
        severity === 'critical' ||
        estimatedImpact.riskLevel === 'high';
    const title = generatePackTitle(category, findings.length, severity);
    return {
        id,
        title,
        severity,
        findings,
        files,
        strategy,
        estimatedImpact,
        requiresHumanReview,
        category,
        createdAt: new Date().toISOString(),
        metadata: {
            repoFingerprint: repoFingerprint.hash,
            generatedBy: 'guardrail-fix-packs',
            version: '1.0.0',
        },
    };
}
function generatePackTitle(category, findingCount, severity) {
    const categoryNames = {
        secrets: 'Secret Exposure',
        auth: 'Authentication Issues',
        security: 'Security Vulnerabilities',
        routes: 'Route Integrity',
        mocks: 'Mock/Demo Code',
        placeholders: 'Placeholder Content',
        deps: 'Dependency Issues',
        types: 'Type Errors',
        tests: 'Test Failures',
        performance: 'Performance Issues',
    };
    const severityPrefix = severity === 'critical' || severity === 'high'
        ? `[${severity.toUpperCase()}] `
        : '';
    return `${severityPrefix}${categoryNames[category]} (${findingCount} ${findingCount === 1 ? 'issue' : 'issues'})`;
}
function generateDeterministicHash(findings, repoFingerprint) {
    const data = findings.map(f => `${f.id}:${f.file}:${f.line || 0}`).sort().join('|');
    const combined = `${repoFingerprint.hash}:${data}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
}
function estimateImpact(findings, files) {
    const filesAffected = files.length;
    const linesChanged = findings.reduce((sum, f) => {
        const lineSpan = (f.endLine || f.line || 1) - (f.line || 1) + 1;
        return sum + Math.max(lineSpan, 1);
    }, 0);
    let riskLevel = 'low';
    const hasCritical = findings.some(f => f.severity === 'critical');
    const hasHigh = findings.some(f => f.severity === 'high');
    if (hasCritical || filesAffected > 10) {
        riskLevel = 'high';
    }
    else if (hasHigh || filesAffected > 5) {
        riskLevel = 'medium';
    }
    const confidence = calculateConfidence(findings);
    const timeEstimateMinutes = Math.ceil(findings.length * 2 + filesAffected * 3);
    return {
        filesAffected,
        linesChanged,
        riskLevel,
        confidence,
        timeEstimateMinutes,
    };
}
function calculateConfidence(findings) {
    const hasAutoFix = findings.filter(f => f.suggestion).length;
    const autoFixRatio = findings.length > 0 ? hasAutoFix / findings.length : 0;
    const avgSeverityScore = findings.reduce((sum, f) => {
        return sum + (4 - types_1.SEVERITY_ORDER[f.severity]);
    }, 0) / Math.max(findings.length, 1);
    return Math.min(100, Math.round((autoFixRatio * 50) + (avgSeverityScore * 10) + 20));
}
// ============================================================================
// STATS
// ============================================================================
function calculateStats(findings, packs) {
    const byCategory = {};
    const bySeverity = {};
    for (const finding of findings) {
        byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
        bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
    }
    return {
        totalFindings: findings.length,
        totalPacks: packs.length,
        byCategory,
        bySeverity,
    };
}
// ============================================================================
// REPO FINGERPRINT GENERATOR
// ============================================================================
function generateRepoFingerprint(projectPath, options) {
    const fs = require('fs');
    const path = require('path');
    const name = options?.name || path.basename(projectPath);
    let hasTypeScript = false;
    let hasTests = false;
    let packageManager;
    let gitRemote;
    try {
        hasTypeScript = fs.existsSync(path.join(projectPath, 'tsconfig.json'));
    }
    catch { /* ignore */ }
    try {
        const testDirs = ['tests', 'test', '__tests__', 'spec'];
        hasTests = testDirs.some(dir => fs.existsSync(path.join(projectPath, dir)));
    }
    catch { /* ignore */ }
    try {
        if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
            packageManager = 'pnpm';
        }
        else if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) {
            packageManager = 'yarn';
        }
        else if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) {
            packageManager = 'npm';
        }
    }
    catch { /* ignore */ }
    try {
        const { execSync } = require('child_process');
        gitRemote = execSync('git remote get-url origin', {
            cwd: projectPath,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
    }
    catch { /* ignore */ }
    const fingerprintData = `${name}:${hasTypeScript}:${hasTests}:${packageManager || ''}:${gitRemote || ''}`;
    const hash = crypto.createHash('sha256').update(fingerprintData).digest('hex').slice(0, 12);
    return {
        id: `repo-${hash}`,
        name,
        framework: options?.framework,
        language: options?.language || (hasTypeScript ? 'typescript' : 'javascript'),
        hasTypeScript,
        hasTests,
        packageManager,
        gitRemote,
        hash,
    };
}
// ============================================================================
// FINDING PARSERS
// ============================================================================
function parseFindingsFromScanOutput(scanOutput) {
    const findings = [];
    try {
        const json = JSON.parse(scanOutput);
        if (Array.isArray(json.findings)) {
            return json.findings.map((f, i) => normalizeFinding(f, i));
        }
        if (Array.isArray(json.issues)) {
            return json.issues.map((f, i) => normalizeFinding(f, i));
        }
        if (Array.isArray(json)) {
            return json.map((f, i) => normalizeFinding(f, i));
        }
    }
    catch {
        return parseTextFindings(scanOutput);
    }
    return findings;
}
function normalizeFinding(raw, index) {
    return {
        id: raw.id || raw.ruleId || `finding-${index}`,
        category: normalizeCategory(raw.category || raw.type || 'security'),
        severity: normalizeSeverity(raw.severity || raw.level || 'medium'),
        title: raw.title || raw.message || raw.description || 'Unknown issue',
        description: raw.description || raw.message || '',
        file: raw.file || raw.filePath || raw.path || 'unknown',
        line: raw.line || raw.startLine || raw.location?.line,
        column: raw.column || raw.startColumn || raw.location?.column,
        endLine: raw.endLine || raw.location?.endLine,
        endColumn: raw.endColumn || raw.location?.endColumn,
        code: raw.code || raw.source,
        suggestion: raw.suggestion || raw.fix || raw.recommendation,
        rule: raw.rule || raw.ruleId,
        metadata: raw.metadata || {},
    };
}
function normalizeCategory(category) {
    const categoryMap = {
        'secret': 'secrets',
        'secrets': 'secrets',
        'credential': 'secrets',
        'api-key': 'secrets',
        'route': 'routes',
        'routes': 'routes',
        'dead-link': 'routes',
        'orphan': 'routes',
        'mock': 'mocks',
        'mocks': 'mocks',
        'demo': 'mocks',
        'fake': 'mocks',
        'auth': 'auth',
        'authentication': 'auth',
        'authorization': 'auth',
        'placeholder': 'placeholders',
        'placeholders': 'placeholders',
        'lorem': 'placeholders',
        'todo': 'placeholders',
        'dep': 'deps',
        'deps': 'deps',
        'dependency': 'deps',
        'dependencies': 'deps',
        'vulnerability': 'deps',
        'type': 'types',
        'types': 'types',
        'typescript': 'types',
        'test': 'tests',
        'tests': 'tests',
        'spec': 'tests',
        'security': 'security',
        'xss': 'security',
        'injection': 'security',
        'performance': 'performance',
        'perf': 'performance',
    };
    const normalized = category.toLowerCase();
    return categoryMap[normalized] || 'security';
}
function normalizeSeverity(severity) {
    const severityMap = {
        'critical': 'critical',
        'blocker': 'critical',
        'high': 'high',
        'error': 'high',
        'major': 'high',
        'medium': 'medium',
        'warning': 'medium',
        'moderate': 'medium',
        'low': 'low',
        'minor': 'low',
        'info': 'info',
        'informational': 'info',
        'note': 'info',
    };
    const normalized = severity.toLowerCase();
    return severityMap[normalized] || 'medium';
}
function parseTextFindings(text) {
    const findings = [];
    const lines = text.split('\n');
    const patterns = [
        /^(.+):(\d+):(\d+):\s*(error|warning|info):\s*(.+)$/i,
        /^(.+)\((\d+),(\d+)\):\s*(error|warning|info)\s+\w+:\s*(.+)$/i,
        /^\s*(error|warning|info)\s+(.+)\s+in\s+(.+):(\d+)/i,
    ];
    let index = 0;
    for (const line of lines) {
        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                findings.push({
                    id: `text-finding-${index++}`,
                    category: 'security',
                    severity: normalizeSeverity(match[4] || 'medium'),
                    title: match[5] || match[2] || 'Unknown issue',
                    description: line,
                    file: match[1] || match[3] || 'unknown',
                    line: parseInt(match[2] || match[4] || '0', 10) || undefined,
                    column: parseInt(match[3] || '0', 10) || undefined,
                });
                break;
            }
        }
    }
    return findings;
}
