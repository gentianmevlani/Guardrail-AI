/**
 * Code Pattern DNA
 * 
 * Creates unique fingerprints for code patterns
 * Unique: DNA-like identification system for code patterns
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
// import * as path from 'path'; // Unused, commented out

export interface PatternDNA {
  id: string;
  fingerprint: string; // SHA-256 hash
  pattern: string;
  structure: {
    complexity: number;
    dependencies: string[];
    patterns: string[];
    conventions: Record<string, string>;
  };
  metadata: {
    firstSeen: string;
    lastSeen: string;
    frequency: number;
    projects: string[];
    variants: Array<{
      fingerprint: string;
      similarity: number;
    }>;
  };
  relationships: {
    parent?: string; // Parent pattern DNA
    children: string[]; // Child pattern DNAs
    siblings: string[]; // Similar patterns
    evolution: Array<{
      timestamp: string;
      fingerprint: string;
      change: string;
    }>;
  };
}

export interface DNAMatch {
  dna: PatternDNA;
  similarity: number;
  differences: string[];
  confidence: number;
}

class CodePatternDNA {
  private dnaRegistry: Map<string, PatternDNA> = new Map();
  private registryFile = '.guardrail-dna-registry.json';

  constructor() {
    this.loadRegistry();
  }

  /**
   * Generate DNA for a code pattern
   */
  generateDNA(
    code: string,
    metadata?: {
      project?: string;
      file?: string;
      context?: string;
    }
  ): PatternDNA {
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
    const dna: PatternDNA = {
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
  findSimilar(dna: PatternDNA, threshold: number = 0.7): DNAMatch[] {
    const matches: DNAMatch[] = [];

    for (const [id, otherDNA] of this.dnaRegistry.entries()) {
      if (id === dna.id) continue;

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
  trackEvolution(originalDNA: PatternDNA, newCode: string): PatternDNA {
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
  findByFingerprint(fingerprint: string): PatternDNA | null {
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
  getFamilyTree(dnaId: string): {
    ancestors: PatternDNA[];
    descendants: PatternDNA[];
    siblings: PatternDNA[];
  } {
    const dna = this.dnaRegistry.get(dnaId);
    if (!dna) {
      return { ancestors: [], descendants: [], siblings: [] };
    }

    const ancestors: PatternDNA[] = [];
    const descendants: PatternDNA[] = [];
    const siblings: PatternDNA[] = [];

    // Find ancestors
    let current = dna;
    while (current.relationships.parent) {
      const parent = this.dnaRegistry.get(current.relationships.parent);
      if (parent) {
        ancestors.push(parent);
        current = parent;
      } else {
        break;
      }
    }

    // Find descendants
    const findDescendants = (id: string) => {
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
  private computeFingerprint(code: string): string {
    const normalized = this.normalizeCode(code);
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Normalize code for fingerprinting
   */
  private normalizeCode(code: string): string {
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
  private analyzeStructure(code: string): PatternDNA['structure'] {
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
  private computeSimilarity(dna1: PatternDNA, dna2: PatternDNA): number {
    // Structural similarity
    const structureSim = this.compareStructures(dna1.structure, dna2.structure);
    
    // Pattern similarity
    const patternSim = this.comparePatterns(
      dna1.structure.patterns,
      dna2.structure.patterns
    );

    // Weighted average
    return (structureSim * 0.6) + (patternSim * 0.4);
  }

  private compareStructures(s1: PatternDNA['structure'], s2: PatternDNA['structure']): number {
    // Simplified comparison
    const complexityDiff = Math.abs(s1.complexity - s2.complexity) / Math.max(s1.complexity, s2.complexity);
    const depOverlap = this.intersection(s1.dependencies, s2.dependencies).length / 
                       Math.max(s1.dependencies.length, s2.dependencies.length);
    
    return 1 - (complexityDiff * 0.5) - ((1 - depOverlap) * 0.5);
  }

  private comparePatterns(p1: string[], p2: string[]): number {
    const intersection = this.intersection(p1, p2).length;
    const union = new Set([...p1, ...p2]).size;
    return union > 0 ? intersection / union : 0;
  }

  private intersection<T>(a: T[], b: T[]): T[] {
    return a.filter(x => b.includes(x));
  }

  private findRelationships(dna: PatternDNA): void {
    // Find siblings (similar patterns)
    const similar = this.findSimilar(dna, 0.6);
    for (const match of similar.slice(0, 5)) {
      dna.relationships.siblings.push(match.dna.id);
      match.dna.relationships.siblings.push(dna.id);
    }
  }

  private findDifferences(dna1: PatternDNA, dna2: PatternDNA): string[] {
    const differences: string[] = [];
    
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

  private computeConfidence(dna1: PatternDNA, dna2: PatternDNA, similarity: number): number {
    // Higher confidence if patterns appear in same projects
    const projectOverlap = this.intersection(
      dna1.metadata.projects,
      dna2.metadata.projects
    ).length;
    const projectBonus = projectOverlap > 0 ? 0.1 : 0;

    return Math.min(1, similarity + projectBonus);
  }

  private computeDiff(original: string, changed: string): string {
    // Simplified diff
    return `Changed from ${original.length} to ${changed.length} characters`;
  }

  private extractDependencies(code: string): string[] {
    // Extract import statements, require calls, etc.
    const imports = code.match(/(?:import|require)\s+['"]([^'"]+)['"]/g) || [];
    return imports.map(imp => imp.replace(/(?:import|require)\s+['"]|['"]/g, ''));
  }

  private extractPatterns(code: string): string[] {
    // Extract common patterns
    const patterns: string[] = [];
    if (code.includes('async') && code.includes('await')) patterns.push('async-await');
    if (code.includes('class')) patterns.push('class-based');
    if (code.includes('function')) patterns.push('functional');
    if (code.includes('useState') || code.includes('useEffect')) patterns.push('react-hooks');
    return patterns;
  }

  private extractConventions(code: string): Record<string, string> {
    // Extract naming conventions, etc.
    return {
      naming: code.match(/const\s+([A-Z])/g) ? 'PascalCase' : 'camelCase',
    };
  }

  private async saveRegistry(): Promise<void> {
    const data = Array.from(this.dnaRegistry.values());
    await fs.promises.writeFile(
      this.registryFile,
      JSON.stringify(data, null, 2)
    );
  }

  private async loadRegistry(): Promise<void> {
    try {
      if (await this.pathExists(this.registryFile)) {
        const content = await fs.promises.readFile(this.registryFile, 'utf8');
        const data = JSON.parse(content);
        for (const dna of data) {
          this.dnaRegistry.set(dna.id, dna);
        }
      }
    } catch {
      // Error loading
    }
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const codePatternDNA = new CodePatternDNA();

