"use strict";
/**
 * Code Pattern DNA
 *
 * Creates unique fingerprints for code patterns
 * Unique: DNA-like identification system for code patterns
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
exports.codePatternDNA = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
class CodePatternDNA {
    dnaRegistry = new Map();
    registryFile = '.guardrail-dna-registry.json';
    constructor() {
        this.loadRegistry();
    }
    /**
     * Generate DNA for a code pattern
     */
    generateDNA(code, metadata) {
        const fingerprint = this.computeFingerprint(code);
        const structure = this.analyzeStructure(code);
        // Check if DNA already exists
        const existing = this.findByFingerprint(fingerprint);
        if (existing) {
            // Update metadata
            existing.metadata.lastSeen = new Date().toISOString();
            existing.metadata.frequency++;
            if (metadata?.project && !existing.metadata.projects.includes(metadata.project)) {
                existing.metadata.projects.push(metadata.project);
            }
            return existing;
        }
        // Create new DNA
        const dna = {
            id: `dna-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fingerprint,
            pattern: code,
            structure,
            metadata: {
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                frequency: 1,
                projects: metadata?.project ? [metadata.project] : [],
                variants: [],
            },
            relationships: {
                children: [],
                siblings: [],
                evolution: [],
            },
        };
        // Find relationships
        this.findRelationships(dna);
        // Register
        this.dnaRegistry.set(dna.id, dna);
        this.saveRegistry();
        return dna;
    }
    /**
     * Find similar patterns by DNA
     */
    findSimilar(dna, threshold = 0.7) {
        const matches = [];
        for (const [id, otherDNA] of this.dnaRegistry.entries()) {
            if (id === dna.id)
                continue;
            const similarity = this.computeSimilarity(dna, otherDNA);
            if (similarity >= threshold) {
                const differences = this.findDifferences(dna, otherDNA);
                matches.push({
                    dna: otherDNA,
                    similarity,
                    differences,
                    confidence: this.computeConfidence(dna, otherDNA, similarity),
                });
            }
        }
        return matches.sort((a, b) => b.similarity - a.similarity);
    }
    /**
     * Track pattern evolution
     */
    trackEvolution(originalDNA, newCode) {
        const newDNA = this.generateDNA(newCode);
        // Check if it's an evolution
        const similarity = this.computeSimilarity(originalDNA, newDNA);
        if (similarity > 0.5 && similarity < 1.0) {
            // It's an evolution
            newDNA.relationships.parent = originalDNA.id;
            originalDNA.relationships.children.push(newDNA.id);
            // Record evolution
            newDNA.relationships.evolution.push({
                timestamp: new Date().toISOString(),
                fingerprint: originalDNA.fingerprint,
                change: this.computeDiff(originalDNA.pattern, newCode),
            });
            // Update variants
            originalDNA.metadata.variants.push({
                fingerprint: newDNA.fingerprint,
                similarity,
            });
        }
        this.saveRegistry();
        return newDNA;
    }
    /**
     * Find pattern by fingerprint
     */
    findByFingerprint(fingerprint) {
        for (const dna of this.dnaRegistry.values()) {
            if (dna.fingerprint === fingerprint) {
                return dna;
            }
        }
        return null;
    }
    /**
     * Get DNA family tree
     */
    getFamilyTree(dnaId) {
        const dna = this.dnaRegistry.get(dnaId);
        if (!dna) {
            return { ancestors: [], descendants: [], siblings: [] };
        }
        const ancestors = [];
        const descendants = [];
        const siblings = [];
        // Find ancestors
        let current = dna;
        while (current.relationships.parent) {
            const parent = this.dnaRegistry.get(current.relationships.parent);
            if (parent) {
                ancestors.push(parent);
                current = parent;
            }
            else {
                break;
            }
        }
        // Find descendants
        const findDescendants = (id) => {
            const d = this.dnaRegistry.get(id);
            if (d) {
                for (const childId of d.relationships.children) {
                    const child = this.dnaRegistry.get(childId);
                    if (child) {
                        descendants.push(child);
                        findDescendants(childId);
                    }
                }
            }
        };
        findDescendants(dnaId);
        // Find siblings
        if (dna.relationships.parent) {
            const parent = this.dnaRegistry.get(dna.relationships.parent);
            if (parent) {
                for (const siblingId of parent.relationships.children) {
                    if (siblingId !== dnaId) {
                        const sibling = this.dnaRegistry.get(siblingId);
                        if (sibling) {
                            siblings.push(sibling);
                        }
                    }
                }
            }
        }
        return { ancestors, descendants, siblings };
    }
    /**
     * Compute fingerprint (SHA-256 hash of normalized code)
     */
    computeFingerprint(code) {
        const normalized = this.normalizeCode(code);
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }
    /**
     * Normalize code for fingerprinting
     */
    normalizeCode(code) {
        // Remove whitespace, normalize identifiers, etc.
        return code
            .replace(/\s+/g, ' ')
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .trim();
    }
    /**
     * Analyze code structure
     */
    analyzeStructure(code) {
        // Simplified analysis
        return {
            complexity: code.split('\n').length,
            dependencies: this.extractDependencies(code),
            patterns: this.extractPatterns(code),
            conventions: this.extractConventions(code),
        };
    }
    /**
     * Compute similarity between two DNAs
     */
    computeSimilarity(dna1, dna2) {
        // Structural similarity
        const structureSim = this.compareStructures(dna1.structure, dna2.structure);
        // Pattern similarity
        const patternSim = this.comparePatterns(dna1.structure.patterns, dna2.structure.patterns);
        // Weighted average
        return (structureSim * 0.6) + (patternSim * 0.4);
    }
    compareStructures(s1, s2) {
        // Simplified comparison
        const complexityDiff = Math.abs(s1.complexity - s2.complexity) / Math.max(s1.complexity, s2.complexity);
        const depOverlap = this.intersection(s1.dependencies, s2.dependencies).length /
            Math.max(s1.dependencies.length, s2.dependencies.length);
        return 1 - (complexityDiff * 0.5) - ((1 - depOverlap) * 0.5);
    }
    comparePatterns(p1, p2) {
        const intersection = this.intersection(p1, p2).length;
        const union = new Set([...p1, ...p2]).size;
        return union > 0 ? intersection / union : 0;
    }
    intersection(a, b) {
        return a.filter(x => b.includes(x));
    }
    findRelationships(dna) {
        // Find siblings (similar patterns)
        const similar = this.findSimilar(dna, 0.6);
        for (const match of similar.slice(0, 5)) {
            dna.relationships.siblings.push(match.dna.id);
            match.dna.relationships.siblings.push(dna.id);
        }
    }
    findDifferences(dna1, dna2) {
        const differences = [];
        if (dna1.structure.complexity !== dna2.structure.complexity) {
            differences.push(`Complexity: ${dna1.structure.complexity} vs ${dna2.structure.complexity}`);
        }
        const uniqueDeps1 = dna1.structure.dependencies.filter(d => !dna2.structure.dependencies.includes(d));
        const uniqueDeps2 = dna2.structure.dependencies.filter(d => !dna1.structure.dependencies.includes(d));
        if (uniqueDeps1.length > 0 || uniqueDeps2.length > 0) {
            differences.push(`Dependencies differ`);
        }
        return differences;
    }
    computeConfidence(dna1, dna2, similarity) {
        // Higher confidence if patterns appear in same projects
        const projectOverlap = this.intersection(dna1.metadata.projects, dna2.metadata.projects).length;
        const projectBonus = projectOverlap > 0 ? 0.1 : 0;
        return Math.min(1, similarity + projectBonus);
    }
    computeDiff(original, changed) {
        // Simplified diff
        return `Changed from ${original.length} to ${changed.length} characters`;
    }
    extractDependencies(code) {
        // Extract import statements, require calls, etc.
        const imports = code.match(/(?:import|require)\s+['"]([^'"]+)['"]/g) || [];
        return imports.map(imp => imp.replace(/(?:import|require)\s+['"]|['"]/g, ''));
    }
    extractPatterns(code) {
        // Extract common patterns
        const patterns = [];
        if (code.includes('async') && code.includes('await'))
            patterns.push('async-await');
        if (code.includes('class'))
            patterns.push('class-based');
        if (code.includes('function'))
            patterns.push('functional');
        if (code.includes('useState') || code.includes('useEffect'))
            patterns.push('react-hooks');
        return patterns;
    }
    extractConventions(code) {
        // Extract naming conventions, etc.
        return {
            naming: code.match(/const\s+([A-Z])/g) ? 'PascalCase' : 'camelCase',
        };
    }
    async saveRegistry() {
        const data = Array.from(this.dnaRegistry.values());
        await fs.promises.writeFile(this.registryFile, JSON.stringify(data, null, 2));
    }
    async loadRegistry() {
        try {
            if (await this.pathExists(this.registryFile)) {
                const content = await fs.promises.readFile(this.registryFile, 'utf8');
                const data = JSON.parse(content);
                for (const dna of data) {
                    this.dnaRegistry.set(dna.id, dna);
                }
            }
        }
        catch {
            // Error loading
        }
    }
    async pathExists(p) {
        try {
            await fs.promises.access(p);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.codePatternDNA = new CodePatternDNA();
