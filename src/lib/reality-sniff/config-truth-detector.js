"use strict";
/**
 * Config Truth Detector
 *
 * Builds environment variable dependency graph and detects dangerous defaults:
 * - Secrets/auth/webhooks/billing URLs with test/empty defaults
 * - Missing required environment variables
 * - Unsafe fallbacks for security-sensitive values
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
exports.ConfigTruthDetector = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SECRET_PATTERNS = /(SECRET|KEY|TOKEN|PASSWORD|PASS|PWD|PRIVATE)/i;
const AUTH_PATTERNS = /(AUTH|JWT|SESSION|COOKIE|CREDENTIAL)/i;
const WEBHOOK_PATTERNS = /(WEBHOOK|HOOK|CALLBACK|NOTIFY)/i;
const BILLING_PATTERNS = /(BILLING|PAYMENT|STRIPE|PAYPAL|PRICE|SUBSCRIPTION)/i;
const URL_PATTERNS = /(URL|URI|ENDPOINT|HOST|HOSTNAME|DOMAIN|API)/i;
const DANGEROUS_DEFAULTS = [
    '',
    'test',
    'demo',
    'localhost',
    '127.0.0.1',
    'example.com',
    'CHANGEME',
    'REPLACE_ME',
    'YOUR_',
    'INSERT_',
];
class ConfigTruthDetector {
    constructor(projectPath) {
        this.dependencies = new Map();
        this.projectPath = projectPath;
    }
    /**
     * Scan for environment variable dependencies
     */
    async detect() {
        const sourceFiles = await this.findSourceFiles();
        for (const filePath of sourceFiles) {
            await this.scanFile(filePath);
        }
        const dangerousDefaults = this.findDangerousDefaults();
        const missingRequired = this.findMissingRequired();
        const findings = this.generateFindings(dangerousDefaults, missingRequired);
        return {
            dependencies: Array.from(this.dependencies.values()),
            dangerousDefaults,
            missingRequired,
            findings,
        };
    }
    async findSourceFiles() {
        const files = [];
        const excludePatterns = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/coverage/**',
            '**/*.test.*',
            '**/*.spec.*',
            '**/__tests__/**',
        ];
        await this.walkDirectory(this.projectPath, files, excludePatterns);
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
                const relativePath = path.relative(this.projectPath, fullPath);
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
    async scanFile(filePath) {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            // Match: process.env.VAR_NAME || 'default' or process.env.VAR_NAME ?? 'default'
            const envPattern = /process\.env\.([A-Z0-9_]+)\s*(?:\|\||\?\?)\s*(['"`])([^'"`]*)\2/g;
            const matches = [...content.matchAll(envPattern)];
            for (const match of matches) {
                const varName = match[1];
                const defaultValue = match[3];
                const lineNumber = this.getLineNumber(content, match.index || 0);
                const category = this.categorizeVariable(varName);
                const required = !defaultValue || this.isDangerousDefault(defaultValue);
                const key = `${filePath}:${varName}`;
                const existing = this.dependencies.get(key);
                if (existing) {
                    existing.usedIn.push(`${filePath}:${lineNumber}`);
                }
                else {
                    this.dependencies.set(key, {
                        name: varName,
                        file: filePath,
                        line: lineNumber,
                        defaultValue,
                        category,
                        required,
                        usedIn: [`${filePath}:${lineNumber}`],
                    });
                }
            }
            // Also match: process.env.VAR_NAME (without default) - these are required
            const requiredPattern = /process\.env\.([A-Z0-9_]+)(?!\s*(?:\|\||\?\?))/g;
            const requiredMatches = [...content.matchAll(requiredPattern)];
            for (const match of requiredMatches) {
                const varName = match[1];
                const lineNumber = this.getLineNumber(content, match.index || 0);
                const category = this.categorizeVariable(varName);
                const key = `${filePath}:${varName}`;
                if (!this.dependencies.has(key)) {
                    this.dependencies.set(key, {
                        name: varName,
                        file: filePath,
                        line: lineNumber,
                        category,
                        required: true,
                        usedIn: [`${filePath}:${lineNumber}`],
                    });
                }
            }
        }
        catch {
            // File read failed
        }
    }
    categorizeVariable(varName) {
        if (SECRET_PATTERNS.test(varName))
            return 'secret';
        if (AUTH_PATTERNS.test(varName))
            return 'auth';
        if (BILLING_PATTERNS.test(varName))
            return 'billing';
        if (WEBHOOK_PATTERNS.test(varName))
            return 'webhook';
        if (URL_PATTERNS.test(varName))
            return 'url';
        return 'harmless';
    }
    isDangerousDefault(value) {
        const normalized = value.toLowerCase().trim();
        return DANGEROUS_DEFAULTS.some(dangerous => normalized === dangerous.toLowerCase() ||
            normalized.includes(dangerous.toLowerCase()));
    }
    findDangerousDefaults() {
        return Array.from(this.dependencies.values()).filter(dep => {
            if (!dep.defaultValue)
                return false;
            const isSecuritySensitive = ['secret', 'auth', 'webhook', 'billing'].includes(dep.category);
            const isDangerous = this.isDangerousDefault(dep.defaultValue);
            return isSecuritySensitive && isDangerous;
        });
    }
    findMissingRequired() {
        // Check .env.example or .env files to see if variables are documented
        const envExamplePath = path.join(this.projectPath, '.env.example');
        const envPath = path.join(this.projectPath, '.env');
        const documentedVars = new Set();
        if (fs.existsSync(envExamplePath)) {
            const content = fs.readFileSync(envExamplePath, 'utf8');
            const matches = content.matchAll(/^([A-Z0-9_]+)=/gm);
            for (const match of matches) {
                documentedVars.add(match[1]);
            }
        }
        return Array.from(this.dependencies.values()).filter(dep => {
            return dep.required && !documentedVars.has(dep.name);
        });
    }
    generateFindings(dangerousDefaults, missingRequired) {
        const findings = [];
        for (const dep of dangerousDefaults) {
            findings.push({
                id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ruleId: 'dangerous-env-default',
                ruleName: 'Dangerous Environment Variable Default',
                severity: dep.category === 'secret' || dep.category === 'auth' ? 'critical' : 'high',
                verdict: 'FAIL',
                evidenceLevel: 'structural',
                confidence: 0.95,
                file: dep.file,
                line: dep.line,
                message: `${dep.category.toUpperCase()} variable "${dep.name}" has dangerous default: "${dep.defaultValue}"`,
                codeSnippet: `process.env.${dep.name} || '${dep.defaultValue}'`,
                evidence: [
                    {
                        type: 'structural',
                        description: `Environment variable "${dep.name}" (${dep.category}) has dangerous default value`,
                        file: dep.file,
                        line: dep.line,
                        code: `process.env.${dep.name} || '${dep.defaultValue}'`,
                    },
                ],
                reachable: true,
                inProdPath: true,
                score: dep.category === 'secret' || dep.category === 'auth' ? 5 : 3,
                fixSuggestion: `Remove default value or use safe fallback. For ${dep.category} variables, fail fast if not set.`,
            });
        }
        for (const dep of missingRequired) {
            findings.push({
                id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ruleId: 'missing-env-var',
                ruleName: 'Missing Required Environment Variable',
                severity: ['secret', 'auth', 'billing'].includes(dep.category) ? 'high' : 'medium',
                verdict: 'WARN',
                evidenceLevel: 'structural',
                confidence: 0.8,
                file: dep.file,
                line: dep.line,
                message: `Required ${dep.category} variable "${dep.name}" not documented in .env.example`,
                codeSnippet: `process.env.${dep.name}`,
                evidence: [
                    {
                        type: 'structural',
                        description: `Required environment variable "${dep.name}" not found in .env.example`,
                        file: dep.file,
                        line: dep.line,
                    },
                ],
                reachable: true,
                inProdPath: true,
                score: 2,
                fixSuggestion: `Add ${dep.name} to .env.example with appropriate documentation`,
            });
        }
        return findings;
    }
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }
}
exports.ConfigTruthDetector = ConfigTruthDetector;
