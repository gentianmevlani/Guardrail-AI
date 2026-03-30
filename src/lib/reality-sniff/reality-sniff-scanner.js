"use strict";
/**
 * Reality Sniff Scanner - Advanced AI Artifact Detection
 *
 * A three-layer verifier that detects AI-generated fake logic with receipts:
 * - Layer 1: Lexical evidence (fast regex sweep)
 * - Layer 2: Structural evidence (AST analysis)
 * - Layer 3: Runtime witness (proof traces)
 *
 * FAIL only when reachability/impact can be proven in prod paths.
 * Everything else WARN/INFO.
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
exports.RealitySniffScanner = void 0;
exports.scanRealitySniff = scanRealitySniff;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const output_contract_1 = require("../cli/output-contract");
// ═══════════════════════════════════════════════════════════════════════════════
// EXCLUSION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_EXCLUDES = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/out/**',
    '**/coverage/**',
    '**/*.min.*',
    '**/*.map',
    '**/*.snap',
    '**/*.lock',
    '**/package-lock.json',
    '**/pnpm-lock.yaml',
    '**/yarn.lock',
];
const NONPROD_HINTS = /(__tests__|\/tests?\/|\/spec\/|\/fixtures\/|\/examples?\/|\/demo\/|\/docs?\/|__mocks__|\/mocks?\/)/;
const PROD_PATHS = /(src\/|app\/|server\/|api\/|packages\/[^/]+\/src\/|lib\/|routes\/)/;
// ═══════════════════════════════════════════════════════════════════════════════
// PASS A: AI ARTIFACT VOCABULARY
// ═══════════════════════════════════════════════════════════════════════════════
const AI_ARTIFACT_PATTERN = /(?i)\b(TODO|FIXME|XXX|HACK|WIP|TBD|TBC|NYI|not implemented|unimplemented|coming soon|placeholder|stub(?:bed)?|dummy|fake|sample data|example data|scaffold(?:ing)?|prototype|poc|workaround|temporary|temp impl|hardcod(?:ed|e))\b/;
// ═══════════════════════════════════════════════════════════════════════════════
// PASS B: SILENT FAILURE PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════
const EMPTY_CATCH_PATTERN = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/;
const SWALLOW_PATTERN = /(?i)\b(swallow|ignore(?:d)?\s+error|silent(?:ly)?|best effort|fallback|gracefully)\b/;
// ═══════════════════════════════════════════════════════════════════════════════
// PASS C: FAKE SUCCESS PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════
const FAKE_SUCCESS_PATTERN = /(?i)(success\s*:\s*true|status\s*:\s*['"]ok['"]|ok\s*:\s*true|return\s+true\b|return\s+\{\s*success\s*:\s*true)/;
// ═══════════════════════════════════════════════════════════════════════════════
// PASS D: AUTH/PERMISSIONS SHORTCUTS
// ═══════════════════════════════════════════════════════════════════════════════
const AUTH_BYPASS_PATTERN = /(?i)\b(bypassAuth|skipAuth|disableAuth|owner\s*mode|admin\s*mode|devOnly|debugOnly|ALLOW_ALL|isAdmin\s*=\s*true|role\s*=\s*['"]admin['"])\b/;
// ═══════════════════════════════════════════════════════════════════════════════
// PASS E: DANGEROUS DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════════
const DANGEROUS_DEFAULT_PATTERN = /process\.env\.[A-Z0-9_]+\s*(\|\||\?\?)\s*(['"][^'"]*['"]|\d+|true|false)/;
const PLACEHOLDER_VALUE_PATTERN = /(CHANGEME|REPLACE_ME|YOUR_[A-Z0-9_]+|INSERT_[A-Z0-9_]+|example\.com|localhost|127\.0\.0\.1)/;
// ═══════════════════════════════════════════════════════════════════════════════
// SCORING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const SCORE_WEIGHTS = {
    emptyCatch: 5,
    authBypass: 5,
    fakeSuccess: 3,
    dangerousDefault: 3,
    placeholder: 1,
    nonProdPath: -3, // Reduces score if in test/example
};
const VERDICT_THRESHOLDS = {
    FAIL: 5,
    WARN: 2,
    INFO: 1,
};
class RealitySniffScanner {
    constructor(options) {
        this.findings = [];
        this.filesScanned = 0;
        this.findingIDs = new Set();
        this.findingIDCounter = new Map();
        this.options = {
            layers: {
                lexical: true,
                structural: false,
                runtime: false,
                ...options.layers,
            },
            excludePatterns: [...DEFAULT_EXCLUDES, ...(options.excludePatterns || [])],
            nonProdPaths: options.nonProdPaths || [],
            verbose: options.verbose || false,
            ...options,
        };
    }
    async scan() {
        const startTime = Date.now();
        this.findings = [];
        this.filesScanned = 0;
        if (this.options.layers?.lexical) {
            await this.runLexicalPass();
        }
        if (this.options.layers?.structural) {
            await this.runStructuralPass();
        }
        if (this.options.layers?.runtime) {
            await this.runRuntimePass();
        }
        // Calculate verdicts and scores
        this.calculateVerdicts();
        const blockers = this.findings.filter(f => f.verdict === 'FAIL');
        const warnings = this.findings.filter(f => f.verdict === 'WARN');
        const info = this.findings.filter(f => f.verdict === 'INFO');
        const overallVerdict = blockers.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';
        const summary = {
            totalFindings: this.findings.length,
            criticalCount: this.findings.filter(f => f.severity === 'critical').length,
            highCount: this.findings.filter(f => f.severity === 'high').length,
            mediumCount: this.findings.filter(f => f.severity === 'medium').length,
            lowCount: this.findings.filter(f => f.severity === 'low').length,
            infoCount: this.findings.filter(f => f.severity === 'info').length,
            byEvidenceLevel: {
                lexical: this.findings.filter(f => f.evidenceLevel === 'lexical').length,
                structural: this.findings.filter(f => f.evidenceLevel === 'structural').length,
                runtime: this.findings.filter(f => f.evidenceLevel === 'runtime').length,
            },
        };
        // Calculate overall score (100 - deductions)
        const maxDeduction = blockers.length * 10 + warnings.length * 5 + info.length * 1;
        const score = Math.max(0, 100 - maxDeduction);
        return {
            verdict: overallVerdict,
            score,
            findings: this.findings,
            blockers,
            warnings,
            info,
            summary,
            executionTime: Date.now() - startTime,
            filesScanned: this.filesScanned,
            layersExecuted: {
                lexical: this.options.layers?.lexical || false,
                structural: this.options.layers?.structural || false,
                runtime: this.options.layers?.runtime || false,
            },
        };
    }
    async runLexicalPass() {
        const sourceFiles = await this.findSourceFiles();
        for (const filePath of sourceFiles) {
            try {
                const content = await fs.promises.readFile(filePath, 'utf8');
                const lines = content.split('\n');
                const relativePath = path.relative(this.options.projectPath, filePath);
                const isNonProd = this.isNonProdPath(relativePath);
                const isProdPath = this.isProdPath(relativePath);
                // Pass A: AI Artifact Vocabulary
                this.scanPattern(filePath, content, lines, 'ai-artifact', 'AI Artifact Vocabulary', AI_ARTIFACT_PATTERN, 'low', isNonProd, isProdPath, SCORE_WEIGHTS.placeholder);
                // Pass B: Silent Failure Patterns
                this.scanPattern(filePath, content, lines, 'empty-catch', 'Empty Catch Block', EMPTY_CATCH_PATTERN, 'critical', isNonProd, isProdPath, SCORE_WEIGHTS.emptyCatch);
                this.scanPattern(filePath, content, lines, 'swallow-error', 'Swallowed Error', SWALLOW_PATTERN, 'high', isNonProd, isProdPath, 2);
                // Pass C: Fake Success Patterns
                this.scanPattern(filePath, content, lines, 'fake-success', 'Fake Success Pattern', FAKE_SUCCESS_PATTERN, 'high', isNonProd, isProdPath, SCORE_WEIGHTS.fakeSuccess);
                // Pass D: Auth Bypass
                this.scanPattern(filePath, content, lines, 'auth-bypass', 'Auth Bypass Pattern', AUTH_BYPASS_PATTERN, 'critical', isNonProd, isProdPath, SCORE_WEIGHTS.authBypass);
                // Pass E: Dangerous Defaults
                this.scanPattern(filePath, content, lines, 'dangerous-default', 'Dangerous Environment Default', DANGEROUS_DEFAULT_PATTERN, 'high', isNonProd, isProdPath, SCORE_WEIGHTS.dangerousDefault);
                this.scanPattern(filePath, content, lines, 'placeholder-value', 'Placeholder Value', PLACEHOLDER_VALUE_PATTERN, 'medium', isNonProd, isProdPath, SCORE_WEIGHTS.placeholder);
                this.filesScanned++;
            }
            catch (error) {
                if (this.options.verbose) {
                    console.warn(`Failed to scan ${filePath}: ${error}`);
                }
            }
        }
    }
    scanPattern(filePath, content, lines, ruleId, ruleName, pattern, severity, isNonProd, isProdPath, baseScore) {
        const matches = [...content.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))];
        for (const match of matches) {
            if (match.index === undefined)
                continue;
            const lineNumber = this.getLineNumber(content, match.index);
            const line = lines[lineNumber - 1] || '';
            const column = match.index - (content.lastIndexOf('\n', match.index) + 1);
            // Calculate score with adjustments
            let score = baseScore;
            if (isNonProd) {
                score += SCORE_WEIGHTS.nonProdPath; // Reduces score
            }
            if (isProdPath && !isNonProd) {
                score += 1; // Increases score for prod paths
            }
            const verdict = this.scoreToVerdict(score);
            const confidence = isProdPath && !isNonProd ? 0.9 : 0.6;
            // Generate stable finding ID
            const category = this.getCategoryFromRuleId(ruleId);
            const counter = this.findingIDCounter.get(category) || 0;
            this.findingIDCounter.set(category, counter + 1);
            const findingID = (0, output_contract_1.generateFindingID)(category, counter, this.findingIDs);
            const finding = {
                id: findingID.full,
                ruleId,
                ruleName,
                severity,
                verdict,
                evidenceLevel: 'lexical',
                confidence,
                file: filePath,
                line: lineNumber,
                column,
                message: this.generateMessage(ruleId, match[0], line),
                codeSnippet: this.getCodeSnippet(lines, lineNumber),
                evidence: [
                    {
                        type: 'lexical',
                        description: `Pattern match: "${match[0]}"`,
                        file: filePath,
                        line: lineNumber,
                        code: line.trim(),
                        strength: 0.3,
                    },
                ],
                reachable: isProdPath,
                inProdPath: isProdPath && !isNonProd,
                score,
                fixSuggestion: this.generateFixSuggestion(ruleId),
                autofixAvailable: this.isAutofixAvailable(ruleId),
                scanId: `scan_${Date.now()}`,
            };
            this.findings.push(finding);
        }
    }
    async runStructuralPass() {
        // Verify findings from lexical pass using AST
        const { astVerifier } = await Promise.resolve().then(() => __importStar(require('./ast-verifier')));
        const lexicalFindings = this.findings.filter(f => f.evidenceLevel === 'lexical');
        for (const finding of lexicalFindings) {
            let verification = null;
            // Verify empty catch blocks
            if (finding.ruleId === 'empty-catch') {
                verification = astVerifier.verifyEmptyCatch(finding.file, finding.line);
                if (verification.verified) {
                    // Upgrade to structural evidence
                    finding.evidenceLevel = 'structural';
                    finding.confidence = Math.max(finding.confidence, verification.confidence);
                    finding.score += 2; // Boost score for structural evidence
                    finding.evidence.push(...verification.evidence);
                }
            }
            // Verify fake success in error path
            if (finding.ruleId === 'fake-success') {
                verification = astVerifier.verifyFakeSuccessInErrorPath(finding.file, finding.line, finding.codeSnippet);
                if (verification.verified) {
                    finding.evidenceLevel = 'structural';
                    finding.confidence = Math.max(finding.confidence, verification.confidence);
                    finding.score += 2;
                    finding.evidence.push(...verification.evidence);
                }
            }
            // Verify auth bypass reachability
            if (finding.ruleId === 'auth-bypass') {
                verification = astVerifier.verifyAuthBypassReachability(finding.file, finding.line);
                if (verification.verified) {
                    finding.evidenceLevel = 'structural';
                    finding.confidence = Math.max(finding.confidence, verification.confidence);
                    finding.score += 3; // Big boost for unguarded auth bypass
                    finding.evidence.push(...verification.evidence);
                }
                else if (verification.confidence < 0.5) {
                    // Guarded - reduce severity
                    finding.score -= 3;
                    finding.severity = finding.severity === 'critical' ? 'high' : 'medium';
                }
            }
        }
        // Recalculate verdicts after structural verification
        this.calculateVerdicts();
    }
    async runRuntimePass() {
        // Runtime witness collection
        const { RouteRealityChecker } = await Promise.resolve().then(() => __importStar(require('./route-reality-checker')));
        const { ConfigTruthDetector } = await Promise.resolve().then(() => __importStar(require('./config-truth-detector')));
        // Route reality checks
        const routeChecker = new RouteRealityChecker(this.options.projectPath);
        await routeChecker.discoverRoutes();
        const routeResult = await routeChecker.verifyHandlers();
        // Upgrade route findings to runtime evidence
        for (const routeFinding of routeResult.findings) {
            routeFinding.evidenceLevel = 'runtime';
            routeFinding.confidence = Math.min(routeFinding.confidence + 0.1, 1.0);
            if (routeFinding.verdict === 'FAIL') {
                routeFinding.score += 2; // Boost score for runtime evidence
            }
            this.findings.push(routeFinding);
        }
        // Config truth detection
        const configDetector = new ConfigTruthDetector(this.options.projectPath);
        const configResult = await configDetector.detect();
        // Upgrade config findings to runtime evidence
        for (const configFinding of configResult.findings) {
            configFinding.evidenceLevel = 'runtime';
            configFinding.confidence = Math.min(configFinding.confidence + 0.1, 1.0);
            if (configFinding.verdict === 'FAIL') {
                configFinding.score += 2;
            }
            this.findings.push(configFinding);
        }
        // Recalculate verdicts after runtime checks
        this.calculateVerdicts();
    }
    calculateVerdicts() {
        // Recalculate verdicts based on final scores and evidence
        for (const finding of this.findings) {
            // Only FAIL if reachable in prod and high confidence
            if (finding.inProdPath && finding.score >= VERDICT_THRESHOLDS.FAIL && finding.confidence >= 0.8) {
                finding.verdict = 'FAIL';
                finding.severity = finding.severity === 'critical' ? 'critical' : 'high';
            }
            else if (finding.score >= VERDICT_THRESHOLDS.WARN) {
                finding.verdict = 'WARN';
            }
            else if (finding.score >= VERDICT_THRESHOLDS.INFO) {
                finding.verdict = 'INFO';
            }
            else {
                finding.verdict = 'PASS';
            }
        }
    }
    async findSourceFiles() {
        const files = [];
        const excludePatterns = this.options.excludePatterns || [];
        await this.walkDirectory(this.options.projectPath, files, excludePatterns);
        return files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
        });
    }
    async walkDirectory(dir, files, excludePatterns) {
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(this.options.projectPath, fullPath);
                if (this.shouldExclude(relativePath, excludePatterns)) {
                    continue;
                }
                if (entry.isDirectory()) {
                    await this.walkDirectory(fullPath, files, excludePatterns);
                }
                else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        }
        catch {
            // Directory not accessible
        }
    }
    shouldExclude(relativePath, patterns) {
        const normalized = relativePath.replace(/\\/g, '/');
        for (const pattern of patterns) {
            const regex = new RegExp(pattern
                .replace(/\*\*/g, '{{GLOBSTAR}}')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '.')
                .replace(/{{GLOBSTAR}}/g, '.*'));
            if (regex.test(normalized)) {
                return true;
            }
        }
        return false;
    }
    isNonProdPath(relativePath) {
        return NONPROD_HINTS.test(relativePath);
    }
    isProdPath(relativePath) {
        return PROD_PATHS.test(relativePath);
    }
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }
    getCodeSnippet(lines, lineNumber, context = 2) {
        const start = Math.max(0, lineNumber - context - 1);
        const end = Math.min(lines.length, lineNumber + context);
        return lines.slice(start, end).join('\n');
    }
    scoreToVerdict(score) {
        if (score >= VERDICT_THRESHOLDS.FAIL)
            return 'FAIL';
        if (score >= VERDICT_THRESHOLDS.WARN)
            return 'WARN';
        if (score >= VERDICT_THRESHOLDS.INFO)
            return 'INFO';
        return 'PASS';
    }
    generateMessage(ruleId, match, line) {
        const messages = {
            'ai-artifact': `AI artifact vocabulary detected: "${match}"`,
            'empty-catch': 'Empty catch block detected - errors are silently swallowed',
            'swallow-error': `Error swallowing pattern detected: "${match}"`,
            'fake-success': `Fake success pattern detected: "${match}"`,
            'auth-bypass': `Auth bypass pattern detected: "${match}"`,
            'dangerous-default': `Dangerous environment variable default detected`,
            'placeholder-value': `Placeholder value detected: "${match}"`,
        };
        return messages[ruleId] || `Pattern detected: "${match}"`;
    }
    generateFixSuggestion(ruleId) {
        const suggestions = {
            'ai-artifact': 'Replace placeholder/stub with actual implementation',
            'empty-catch': 'Add error logging and/or rethrow: catch (err) { logger.error(err); throw err; }',
            'swallow-error': 'Remove error swallowing or add proper error handling',
            'fake-success': 'Return actual error response instead of fake success',
            'auth-bypass': 'Remove auth bypass or guard behind safe build-time flag',
            'dangerous-default': 'Remove default value or use safe fallback',
            'placeholder-value': 'Replace placeholder with actual value or environment variable',
        };
        return suggestions[ruleId] || 'Review and fix the detected pattern';
    }
    getCategoryFromRuleId(ruleId) {
        const categoryMap = {
            'ai-artifact': 'REALITY',
            'empty-catch': 'REALITY',
            'swallow-error': 'REALITY',
            'fake-success': 'REALITY',
            'auth-bypass': 'AUTH',
            'dangerous-default': 'CONFIG',
            'placeholder-value': 'REALITY',
        };
        return categoryMap[ruleId] || 'REALITY';
    }
    isAutofixAvailable(ruleId) {
        // Rules that can be autofixed
        const autofixable = ['empty-catch', 'dangerous-default', 'placeholder-value'];
        return autofixable.includes(ruleId);
    }
}
exports.RealitySniffScanner = RealitySniffScanner;
async function scanRealitySniff(options) {
    const scanner = new RealitySniffScanner(options);
    return scanner.scan();
}
