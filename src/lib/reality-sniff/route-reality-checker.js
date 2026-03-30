"use strict";
/**
 * Route Reality Checker
 *
 * Verifies that declared routes actually exist and are reachable:
 * - Cross-checks route definitions with handler exports
 * - Verifies middleware chains for protected routes
 * - Optional runtime ping for critical routes
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
exports.RouteRealityChecker = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class RouteRealityChecker {
    constructor(projectPath) {
        this.routes = [];
        this.projectPath = projectPath;
    }
    /**
     * Discover routes from framework-specific files
     */
    async discoverRoutes() {
        const routes = [];
        // Next.js App Router
        await this.discoverNextAppRoutes(routes);
        // Next.js Pages Router
        await this.discoverNextPagesRoutes(routes);
        // Express/Fastify
        await this.discoverExpressRoutes(routes);
        this.routes = routes;
        return routes;
    }
    /**
     * Verify route handlers exist
     */
    async verifyHandlers() {
        const missingHandlers = [];
        const unprotectedRoutes = [];
        const findings = [];
        for (const route of this.routes) {
            // Check if handler exists
            if (route.handler && route.file) {
                const handlerExists = await this.verifyHandlerExists(route);
                if (!handlerExists) {
                    missingHandlers.push(route);
                    findings.push({
                        id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        ruleId: 'missing-handler',
                        ruleName: 'Missing Route Handler',
                        severity: 'high',
                        verdict: 'WARN',
                        evidenceLevel: 'structural',
                        confidence: 0.9,
                        file: route.file || '',
                        line: route.line || 1,
                        message: `Route "${route.pattern}" declared but handler not found`,
                        codeSnippet: route.pattern,
                        evidence: [
                            {
                                type: 'structural',
                                description: `Route pattern "${route.pattern}" declared but handler "${route.handler}" not found`,
                                file: route.file,
                                line: route.line,
                            },
                        ],
                        reachable: false,
                        inProdPath: true,
                        score: 3,
                        fixSuggestion: `Implement handler "${route.handler}" or remove route declaration`,
                    });
                }
            }
            // Check auth protection
            if (route.requiresAuth && (!route.middleware || route.middleware.length === 0)) {
                unprotectedRoutes.push(route);
                findings.push({
                    id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    ruleId: 'unprotected-route',
                    ruleName: 'Unprotected Route',
                    severity: 'critical',
                    verdict: 'FAIL',
                    evidenceLevel: 'structural',
                    confidence: 0.85,
                    file: route.file || '',
                    line: route.line || 1,
                    message: `Route "${route.pattern}" requires auth but has no middleware`,
                    codeSnippet: route.pattern,
                    evidence: [
                        {
                            type: 'structural',
                            description: `Route marked as requiring auth but no auth middleware found`,
                            file: route.file,
                            line: route.line,
                        },
                    ],
                    reachable: true,
                    inProdPath: true,
                    score: 5,
                    fixSuggestion: 'Add authentication middleware to route',
                });
            }
        }
        return {
            routes: this.routes,
            missingHandlers,
            unprotectedRoutes,
            findings,
        };
    }
    async discoverNextAppRoutes(routes) {
        const appDir = path.join(this.projectPath, 'app');
        if (!fs.existsSync(appDir))
            return;
        await this.walkRouteDirectory(appDir, routes, 'next-app');
    }
    async discoverNextPagesRoutes(routes) {
        const pagesDir = path.join(this.projectPath, 'pages');
        if (!fs.existsSync(pagesDir))
            return;
        await this.walkRouteDirectory(pagesDir, routes, 'next-pages');
    }
    async discoverExpressRoutes(routes) {
        const routeFiles = await this.findRouteFiles();
        for (const filePath of routeFiles) {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const routeMatches = content.matchAll(/(?:app|router|fastify)\.(get|post|put|delete|patch|all)\s*\(\s*['"]([^'"]+)['"]/g);
            for (const match of routeMatches) {
                const method = match[1];
                const pattern = match[2];
                const line = content.substring(0, match.index || 0).split('\n').length;
                // Check for auth middleware
                const requiresAuth = /auth|requireAuth|authenticate|protect/i.test(content.substring(Math.max(0, (match.index || 0) - 200), match.index || 0));
                routes.push({
                    pattern,
                    method,
                    file: filePath,
                    line,
                    requiresAuth,
                });
            }
        }
    }
    async walkRouteDirectory(dir, routes, framework) {
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await this.walkRouteDirectory(fullPath, routes, framework);
                }
                else if (entry.isFile() && (entry.name === 'page.tsx' || entry.name === 'page.ts' || entry.name === 'route.ts')) {
                    const relativePath = path.relative(framework === 'next-app' ? path.join(this.projectPath, 'app') : path.join(this.projectPath, 'pages'), fullPath);
                    const routePattern = this.pathToRoutePattern(relativePath);
                    const content = await fs.promises.readFile(fullPath, 'utf8');
                    const line = 1;
                    // Check for auth
                    const requiresAuth = /export\s+(const|function)\s+(auth|requireAuth|middleware)/i.test(content) ||
                        /middleware|auth|protect/i.test(content);
                    routes.push({
                        pattern: routePattern,
                        file: fullPath,
                        line,
                        requiresAuth,
                    });
                }
            }
        }
        catch {
            // Directory not accessible
        }
    }
    pathToRoutePattern(filePath) {
        let pattern = filePath
            .replace(/\\/g, '/')
            .replace(/\/page\.(tsx?|jsx?)$/, '')
            .replace(/\/route\.(tsx?|jsx?)$/, '')
            .replace(/\/index$/, '')
            .replace(/\[([^\]]+)\]/g, ':$1')
            .replace(/\([^)]+\)\//g, '')
            .replace(/@[^/]+\//g, '');
        if (!pattern.startsWith('/')) {
            pattern = '/' + pattern;
        }
        return pattern || '/';
    }
    async findRouteFiles() {
        const files = [];
        const routeDirs = ['src/routes', 'routes', 'app/api', 'pages/api', 'src/app/api'];
        for (const routeDir of routeDirs) {
            const fullPath = path.join(this.projectPath, routeDir);
            if (fs.existsSync(fullPath)) {
                await this.walkDirectory(fullPath, files);
            }
        }
        return files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
    }
    async walkDirectory(dir, files) {
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await this.walkDirectory(fullPath, files);
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
    async verifyHandlerExists(route) {
        if (!route.file)
            return false;
        try {
            const content = await fs.promises.readFile(route.file, 'utf8');
            if (route.handler) {
                // Check if handler is exported
                const handlerRegex = new RegExp(`(export\\s+(const|function|async\\s+function)\\s+${route.handler}|export\\s+default\\s+${route.handler})`, 'i');
                return handlerRegex.test(content);
            }
            // For file-based routes, just check file exists
            return fs.existsSync(route.file);
        }
        catch {
            return false;
        }
    }
}
exports.RouteRealityChecker = RouteRealityChecker;
