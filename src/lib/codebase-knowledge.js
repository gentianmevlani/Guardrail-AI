"use strict";
/**
 * Codebase Knowledge Base
 *
 * Deep understanding of a specific codebase - more context than general AI agents
 * Builds and maintains project-specific knowledge over time
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
exports.codebaseKnowledgeBase = exports.CodebaseKnowledgeBase = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class CodebaseKnowledgeBase {
    knowledgeFile = '.codebase-knowledge.json';
    /**
     * Build deep knowledge of codebase
     *
     * Analyzes the entire codebase and builds comprehensive knowledge including
     * architecture, patterns, decisions, and relationships.
     *
     * @param projectPath - Path to the project root directory
     * @returns Complete codebase knowledge
     *
     * @example
     * ```typescript
     * const knowledge = await codebaseKnowledgeBase.buildKnowledge('./my-project');
     *
     * // Use the knowledge
     * console.log(`Project type: ${knowledge.architecture.structure.type}`);
     * console.log(`Patterns found: ${knowledge.patterns.length}`);
     * ```
     */
    async buildKnowledge(projectPath) {
        console.log('🧠 Building deep codebase knowledge...');
        const knowledge = {
            projectId: this.getProjectId(projectPath),
            projectPath,
            architecture: await this.analyzeArchitecture(projectPath),
            patterns: await this.detectPatterns(projectPath),
            decisions: await this.loadDecisions(projectPath),
            relationships: await this.mapRelationships(projectPath),
            context: await this.buildContext(projectPath),
            lastUpdated: new Date().toISOString(),
        };
        await this.saveKnowledge(projectPath, knowledge);
        return knowledge;
    }
    /**
     * Analyze architecture
     */
    async analyzeArchitecture(projectPath) {
        const structure = await this.detectStructure(projectPath);
        const techStack = await this.detectTechStack(projectPath);
        const conventions = await this.detectConventions(projectPath);
        return {
            structure,
            techStack,
            conventions,
        };
    }
    /**
     * Detect project structure
     */
    async detectStructure(projectPath) {
        const srcPath = path.join(projectPath, 'src');
        const hasSrc = await this.pathExists(srcPath);
        // Detect type
        let type = 'unknown';
        const hasMicroservices = await this.findFile(projectPath, /service|microservice/i);
        const hasModules = await this.findFile(projectPath, /modules|features/i);
        if (hasMicroservices) {
            type = 'microservices';
        }
        else if (hasModules) {
            type = 'modular';
        }
        else if (hasSrc) {
            type = 'monolith';
        }
        // Detect layers
        const layers = [];
        if (await this.pathExists(path.join(projectPath, 'src', 'components')))
            layers.push('components');
        if (await this.pathExists(path.join(projectPath, 'src', 'pages')))
            layers.push('pages');
        if (await this.pathExists(path.join(projectPath, 'src', 'services')))
            layers.push('services');
        if (await this.pathExists(path.join(projectPath, 'src', 'hooks')))
            layers.push('hooks');
        if (await this.pathExists(path.join(projectPath, 'src', 'utils')))
            layers.push('utils');
        // Detect entry points
        const entryPoints = [];
        const packageJson = path.join(projectPath, 'package.json');
        if (await this.pathExists(packageJson)) {
            const pkg = JSON.parse(await fs.promises.readFile(packageJson, 'utf8'));
            if (pkg.main)
                entryPoints.push(pkg.main);
            if (pkg.bin) {
                const binEntries = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin || {});
                binEntries.forEach((entry) => {
                    if (typeof entry === 'string') {
                        entryPoints.push(entry);
                    }
                });
            }
        }
        // Detect main modules
        const mainModules = [];
        if (hasSrc) {
            const items = await fs.promises.readdir(srcPath, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory()) {
                    mainModules.push(item.name);
                }
            }
        }
        return {
            type,
            layers,
            entryPoints,
            mainModules,
        };
    }
    /**
     * Detect tech stack
     */
    async detectTechStack(projectPath) {
        const packageJson = path.join(projectPath, 'package.json');
        if (!await this.pathExists(packageJson)) {
            return { frontend: [], backend: [], database: [], tools: [] };
        }
        const pkg = JSON.parse(await fs.promises.readFile(packageJson, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const frontend = [];
        const backend = [];
        const database = [];
        const tools = [];
        // Frontend
        if (deps['react'])
            frontend.push('react');
        if (deps['vue'])
            frontend.push('vue');
        if (deps['angular'])
            frontend.push('angular');
        if (deps['next'])
            frontend.push('next');
        if (deps['svelte'])
            frontend.push('svelte');
        if (deps['tailwindcss'])
            frontend.push('tailwindcss');
        // Backend
        if (deps['express'])
            backend.push('express');
        if (deps['fastify'])
            backend.push('fastify');
        if (deps['nestjs'])
            backend.push('nestjs');
        if (deps['koa'])
            backend.push('koa');
        // Database
        if (deps['pg'] || deps['postgres'])
            database.push('postgresql');
        if (deps['mysql2'])
            database.push('mysql');
        if (deps['mongodb'])
            database.push('mongodb');
        if (deps['prisma'])
            database.push('prisma');
        // Tools
        if (deps['typescript'])
            tools.push('typescript');
        if (deps['eslint'])
            tools.push('eslint');
        if (deps['prettier'])
            tools.push('prettier');
        return { frontend, backend, database, tools };
    }
    /**
     * Detect conventions
     */
    async detectConventions(projectPath) {
        const conventions = {
            naming: {},
            fileOrganization: [],
            importPatterns: [],
        };
        // Analyze file naming
        const files = await this.findCodeFiles(projectPath);
        const namingPatterns = new Map();
        for (const file of files.slice(0, 50)) {
            const name = path.basename(file);
            const ext = path.extname(name);
            const base = name.replace(ext, '');
            // Detect naming convention
            if (base.includes('-')) {
                namingPatterns.set('kebab-case', (namingPatterns.get('kebab-case') || 0) + 1);
            }
            else if (base.includes('_')) {
                namingPatterns.set('snake_case', (namingPatterns.get('snake_case') || 0) + 1);
            }
            else if (base && base.length > 0 && base[0].toUpperCase() === base[0]) {
                namingPatterns.set('PascalCase', (namingPatterns.get('PascalCase') || 0) + 1);
            }
            else {
                namingPatterns.set('camelCase', (namingPatterns.get('camelCase') || 0) + 1);
            }
        }
        const mostCommon = Array.from(namingPatterns.entries())
            .sort((a, b) => b[1] - a[1])[0];
        if (mostCommon) {
            conventions.naming['files'] = mostCommon[0];
        }
        // Detect import patterns
        const importPatterns = new Set();
        for (const file of files.slice(0, 20)) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const imports = content.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];
                imports.forEach(imp => {
                    if (imp.includes('@/'))
                        importPatterns.add('path-aliases');
                    if (imp.includes('../'))
                        importPatterns.add('relative');
                    if (imp.startsWith('import') && !imp.includes('./') && !imp.includes('@/')) {
                        importPatterns.add('absolute');
                    }
                });
            }
            catch (error) {
                // Failed to process - continue with other operations
            }
        }
        conventions.importPatterns = Array.from(importPatterns);
        return conventions;
    }
    /**
     * Detect patterns in codebase
     */
    async detectPatterns(projectPath) {
        const patterns = [];
        const files = await this.findCodeFiles(projectPath);
        // Component patterns
        const componentFiles = files.filter(f => f.includes('components') && (f.endsWith('.tsx') || f.endsWith('.jsx')));
        if (componentFiles.length > 0) {
            patterns.push({
                id: 'component-pattern',
                name: 'Component Pattern',
                description: 'React/Vue components organized in components directory',
                examples: componentFiles.slice(0, 5),
                frequency: componentFiles.length,
                category: 'component',
            });
        }
        // Hook patterns
        const hookFiles = files.filter(f => (f.includes('hooks') || f.includes('use')) && f.endsWith('.ts'));
        if (hookFiles.length > 0) {
            patterns.push({
                id: 'hook-pattern',
                name: 'Custom Hooks Pattern',
                description: 'Custom hooks for reusable logic',
                examples: hookFiles.slice(0, 5),
                frequency: hookFiles.length,
                category: 'hook',
            });
        }
        // API patterns
        const apiFiles = files.filter(f => f.includes('api') || f.includes('routes') || f.includes('endpoints'));
        if (apiFiles.length > 0) {
            patterns.push({
                id: 'api-pattern',
                name: 'API Pattern',
                description: 'API routes organized in dedicated files',
                examples: apiFiles.slice(0, 5),
                frequency: apiFiles.length,
                category: 'api',
            });
        }
        return patterns;
    }
    /**
     * Map file relationships
     */
    async mapRelationships(projectPath) {
        const relationships = {
            dependencies: new Map(),
            dependents: new Map(),
            imports: new Map(),
            exports: new Map(),
        };
        const files = await this.findCodeFiles(projectPath);
        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const relativePath = path.relative(projectPath, file);
                // Extract imports
                const imports = [];
                const importRegex = /import\s+.*from\s+['"]([^'"]+)['"]/g;
                let match;
                while ((match = importRegex.exec(content)) !== null) {
                    imports.push(match[1] || '');
                }
                relationships.imports.set(relativePath, imports);
                // Extract exports
                const exports = [];
                const exportRegex = /export\s+(?:const|function|class|default|interface|type)\s+(\w+)/g;
                while ((match = exportRegex.exec(content)) !== null) {
                    exports.push(match[1] || '');
                }
                relationships.exports.set(relativePath, exports);
                // Build dependency graph
                const fileDependencies = [];
                for (const importPath of imports) {
                    // Convert relative import to file path
                    if (importPath.startsWith('.')) {
                        const absoluteImport = path.resolve(path.dirname(relativePath), importPath);
                        // Add common extensions
                        const possibleFiles = [
                            absoluteImport + '.ts',
                            absoluteImport + '.tsx',
                            absoluteImport + '.js',
                            absoluteImport + '.jsx',
                            path.join(absoluteImport, 'index.ts'),
                            path.join(absoluteImport, 'index.tsx')
                        ];
                        for (const possibleFile of possibleFiles) {
                            if (files.includes(possibleFile)) {
                                fileDependencies.push(possibleFile);
                                break;
                            }
                        }
                    }
                }
                if (fileDependencies.length > 0) {
                    relationships.dependencies.set(relativePath, fileDependencies);
                    // Update dependents
                    for (const dep of fileDependencies) {
                        if (!relationships.dependents.has(dep)) {
                            relationships.dependents.set(dep, []);
                        }
                        relationships.dependents.get(dep).push(relativePath);
                    }
                }
            }
            catch (error) {
                // Failed to process - continue with other operations
            }
        }
        return relationships;
    }
    /**
     * Build context memory
     */
    async buildContext(projectPath) {
        // Get recent git changes
        const recentChanges = await this.getRecentChanges(projectPath);
        // Detect active features
        const activeFeatures = await this.detectActiveFeatures(projectPath);
        return {
            recentChanges,
            activeFeatures,
            currentFocus: [],
            painPoints: [],
            improvements: [],
        };
    }
    /**
     * Get recent changes from git
     */
    async getRecentChanges(projectPath) {
        try {
            const result = (0, child_process_1.execSync)('git log --oneline --name-only -10', {
                cwd: projectPath,
                encoding: 'utf8',
            });
            const changes = [];
            const lines = result.split('\n');
            let currentCommit = '';
            for (const line of lines) {
                if (line && !line.startsWith(' ')) {
                    currentCommit = line;
                }
                else if (line.trim()) {
                    changes.push({
                        file: line.trim(),
                        change: currentCommit,
                        date: new Date().toISOString(), // Would parse from git log
                    });
                }
            }
            return changes.slice(0, 10);
        }
        catch {
            return [];
        }
    }
    /**
     * Detect active features
     */
    async detectActiveFeatures(projectPath) {
        const features = [];
        const srcPath = path.join(projectPath, 'src');
        if (await this.pathExists(srcPath)) {
            const items = await fs.promises.readdir(srcPath, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory() && (item.name === 'features' || item.name === 'modules')) {
                    const featurePath = path.join(srcPath, item.name);
                    const featureDirs = await fs.promises.readdir(featurePath, { withFileTypes: true });
                    for (const feature of featureDirs) {
                        if (feature.isDirectory()) {
                            features.push(feature.name);
                        }
                    }
                }
            }
        }
        return features;
    }
    /**
     * Load decisions from knowledge base
     */
    async loadDecisions(projectPath) {
        const knowledgePath = path.join(projectPath, this.knowledgeFile);
        if (!await this.pathExists(knowledgePath)) {
            return [];
        }
        try {
            const knowledge = JSON.parse(await fs.promises.readFile(knowledgePath, 'utf8'));
            return knowledge.decisions || [];
        }
        catch {
            return [];
        }
    }
    /**
     * Save knowledge base
     */
    async saveKnowledge(projectPath, knowledge) {
        const knowledgePath = path.join(projectPath, this.knowledgeFile);
        await fs.promises.writeFile(knowledgePath, JSON.stringify(knowledge, null, 2));
    }
    /**
     * Get knowledge for project
     */
    async loadKnowledge(projectPath) {
        const knowledgePath = path.join(projectPath, this.knowledgeFile);
        if (!await this.pathExists(knowledgePath)) {
            return null;
        }
        try {
            return JSON.parse(await fs.promises.readFile(knowledgePath, 'utf8'));
        }
        catch {
            return null;
        }
    }
    /**
     * Add decision to knowledge base
     */
    async addDecision(projectPath, decision) {
        const knowledge = await this.loadKnowledge(projectPath) || await this.buildKnowledge(projectPath);
        knowledge.decisions.push({
            ...decision,
            id: `decision-${Date.now()}`,
            date: new Date().toISOString(),
        });
        await this.saveKnowledge(projectPath, knowledge);
    }
    /**
     * Update context memory
     */
    async updateContext(projectPath, updates) {
        const knowledge = await this.loadKnowledge(projectPath) || await this.buildKnowledge(projectPath);
        knowledge.context = {
            ...knowledge.context,
            ...updates,
        };
        await this.saveKnowledge(projectPath, knowledge);
    }
    /**
     * Search knowledge base
     */
    async searchKnowledge(projectPath, query) {
        const knowledge = await this.loadKnowledge(projectPath);
        if (!knowledge) {
            return { patterns: [], decisions: [], files: [] };
        }
        const lowerQuery = query.toLowerCase();
        const matchingPatterns = knowledge.patterns.filter((p) => p.name.toLowerCase().includes(lowerQuery) ||
            p.description.toLowerCase().includes(lowerQuery));
        const matchingDecisions = knowledge.decisions.filter((d) => d.question.toLowerCase().includes(lowerQuery) ||
            d.decision.toLowerCase().includes(lowerQuery) ||
            d.rationale.toLowerCase().includes(lowerQuery));
        // Find relevant files
        const files = [];
        Array.from(knowledge.relationships.imports.entries()).forEach(([file, _imports]) => {
            if (file.toLowerCase().includes(lowerQuery)) {
                files.push(file);
            }
        });
        return {
            patterns: matchingPatterns,
            decisions: matchingDecisions,
            files,
        };
    }
    // Helper methods
    async pathExists(p) {
        try {
            await fs.promises.access(p);
            return true;
        }
        catch {
            return false;
        }
    }
    async findFile(dir, pattern) {
        try {
            const items = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory() && !this.shouldIgnore(item.name)) {
                    if (await this.findFile(fullPath, pattern))
                        return true;
                }
                else if (item.isFile() && pattern.test(item.name)) {
                    return true;
                }
            }
        }
        catch (error) {
            // Failed to process - continue with other operations
        }
        return false;
    }
    async findCodeFiles(dir) {
        const files = [];
        try {
            const items = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory() && !this.shouldIgnore(item.name)) {
                    files.push(...await this.findCodeFiles(fullPath));
                }
                else if (item.isFile() && /\.(ts|tsx|js|jsx)$/.test(item.name)) {
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
            // Failed to process - continue with other operations
        }
        return files;
    }
    shouldIgnore(name) {
        return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(name);
    }
    getProjectId(projectPath) {
        return Buffer.from(projectPath).toString('base64').substring(0, 16);
    }
}
exports.CodebaseKnowledgeBase = CodebaseKnowledgeBase;
exports.codebaseKnowledgeBase = new CodebaseKnowledgeBase();
