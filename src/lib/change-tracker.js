"use strict";
/**
 * Change Tracker
 *
 * Tracks changes in knowledge base and provides visual diffs
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
exports.changeTracker = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
class ChangeTracker {
    // Note: changeHistory removed to fix unused variable error
    // Can be re-added when needed
    /**
     * Track changes in project
     */
    async trackChanges(projectPath, since) {
        const changes = [];
        try {
            // Get git changes if available
            const gitChanges = await this.getGitChanges(projectPath, since);
            changes.push(...gitChanges);
        }
        catch {
            // Not a git repo or git not available
        }
        // Get file system changes
        const fsChanges = await this.getFileSystemChanges(projectPath, since);
        changes.push(...fsChanges);
        // Sort by timestamp
        changes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const summary = {
            added: changes.filter(c => c.type === 'added').length,
            modified: changes.filter(c => c.type === 'modified').length,
            deleted: changes.filter(c => c.type === 'deleted').length,
        };
        return {
            projectPath,
            period: {
                start: since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString(),
            },
            changes,
            summary,
        };
    }
    /**
     * Visualize diff between two knowledge bases
     */
    async visualizeDiff(before, after) {
        const differences = [];
        // Compare patterns
        const beforePatterns = new Map(before.patterns.map(p => [p.id, p]));
        const afterPatterns = new Map(after.patterns.map(p => [p.id, p]));
        for (const [id, pattern] of afterPatterns.entries()) {
            const beforePattern = beforePatterns.get(id);
            if (!beforePattern) {
                differences.push({
                    path: `patterns.${id}`,
                    before: undefined,
                    after: pattern,
                    type: 'added',
                });
            }
            else if (JSON.stringify(beforePattern) !== JSON.stringify(pattern)) {
                differences.push({
                    path: `patterns.${id}`,
                    before: beforePattern,
                    after: pattern,
                    type: 'modified',
                });
            }
        }
        for (const [id] of beforePatterns.entries()) {
            if (!afterPatterns.has(id)) {
                differences.push({
                    path: `patterns.${id}`,
                    before: beforePatterns.get(id),
                    after: undefined,
                    type: 'deleted',
                });
            }
        }
        // Compare decisions
        const beforeDecisions = new Map(before.decisions.map(d => [d.id, d]));
        const afterDecisions = new Map(after.decisions.map(d => [d.id, d]));
        for (const [id, decision] of afterDecisions.entries()) {
            if (!beforeDecisions.has(id)) {
                differences.push({
                    path: `decisions.${id}`,
                    before: undefined,
                    after: decision,
                    type: 'added',
                });
            }
        }
        // Compare architecture
        if (JSON.stringify(before.architecture) !== JSON.stringify(after.architecture)) {
            differences.push({
                path: 'architecture',
                before: before.architecture,
                after: after.architecture,
                type: 'modified',
            });
        }
        return {
            before: {
                patterns: before.patterns,
                decisions: before.decisions,
                architecture: before.architecture,
            },
            after: {
                patterns: after.patterns,
                decisions: after.decisions,
                architecture: after.architecture,
            },
            differences,
        };
    }
    /**
     * Get changes from git
     */
    async getGitChanges(projectPath, since) {
        const changes = [];
        try {
            const sinceArg = since ? `--since="${since}"` : '--since="7 days ago"';
            const result = (0, child_process_1.execSync)(`git log --name-status --pretty=format:"%H|%ai|%s" ${sinceArg}`, { cwd: projectPath, encoding: 'utf8' });
            const lines = result.split('\n');
            // Note: currentCommit removed as it was unused
            let currentTimestamp = undefined;
            let currentMessage = undefined;
            for (const line of lines) {
                if (line.includes('|')) {
                    const [hash, timestamp, ...messageParts] = line.split('|');
                    currentCommit = hash || '';
                    currentTimestamp = timestamp || undefined;
                    currentMessage = messageParts.join('|') || undefined;
                }
                else if (line.match(/^[AMD]\s+/)) {
                    const match = line.match(/^([AMD])\s+(.+)$/);
                    if (match) {
                        const [, status, file] = match;
                        let type;
                        if (status === 'A')
                            type = 'added';
                        else if (status === 'M')
                            type = 'modified';
                        else
                            type = 'deleted';
                        changes.push({
                            type,
                            file: file || '',
                            timestamp: currentTimestamp || '',
                            description: currentMessage || '',
                        });
                    }
                }
            }
        }
        catch {
            // Git not available or not a git repo
        }
        return changes;
    }
    /**
     * Get changes from file system
     */
    async getFileSystemChanges(projectPath, since) {
        const changes = [];
        const sinceTime = since ? new Date(since).getTime() : Date.now() - 7 * 24 * 60 * 60 * 1000;
        try {
            const files = await this.findFiles(projectPath);
            for (const file of files) {
                const stats = await fs.promises.stat(file);
                if (stats.mtime.getTime() > sinceTime) {
                    changes.push({
                        type: 'modified',
                        file: path.relative(projectPath, file),
                        timestamp: stats.mtime.toISOString(),
                    });
                }
            }
        }
        catch {
            // Error reading files
        }
        return changes;
    }
    /**
     * Find all files in project
     */
    async findFiles(dir) {
        const files = [];
        try {
            const items = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory() && !this.shouldIgnore(item.name)) {
                    files.push(...await this.findFiles(fullPath));
                }
                else if (item.isFile()) {
                    files.push(fullPath);
                }
            }
        }
        catch {
            // Error reading directory
        }
        return files;
    }
    shouldIgnore(name) {
        return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.guardrail-cache'].includes(name);
    }
}
exports.changeTracker = new ChangeTracker();
