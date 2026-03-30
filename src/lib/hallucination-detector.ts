/**
 * Hallucination Detector
 * 
 * Detects and prevents AI hallucinations in generated code
 * Target: Reduce hallucinations by ~90%
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from './codebase-knowledge';
import { codePatternDNA } from './code-pattern-dna';
import { apiValidator } from './api-validator';

export interface HallucinationCheck {
  type: 'missing-import' | 'wrong-pattern' | 'fake-endpoint' | 'invalid-type' | 'wrong-structure' | 'outdated-api';
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number; // 0-1
  detected: string;
  expected: string;
  suggestion: string;
  evidence: string[];
}

export interface HallucinationReport {
  hasHallucinations: boolean;
  score: number; // 0-100, higher = more hallucinations
  checks: HallucinationCheck[];
  suggestions: string[];
  confidence: number;
}

class HallucinationDetector {
  /**
   * Check generated code for hallucinations
   */
  async detect(
    generatedCode: string,
    projectPath: string,
    context?: {
      file?: string;
      purpose?: string;
      relatedFiles?: string[];
    }
  ): Promise<HallucinationReport> {
    const checks: HallucinationCheck[] = [];

    // Get knowledge base
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      return {
        hasHallucinations: false,
        score: 0,
        checks: [],
        suggestions: ['Knowledge base not found - run build-knowledge first'],
        confidence: 0,
      };
    }

    // Check 1: Missing imports
    const importChecks = await this.checkImports(generatedCode, knowledge, context);
    checks.push(...importChecks);

    // Check 2: Wrong patterns
    const patternChecks = await this.checkPatterns(generatedCode, knowledge);
    checks.push(...patternChecks);

    // Check 3: Fake endpoints
    const endpointChecks = await this.checkEndpoints(generatedCode, projectPath);
    checks.push(...endpointChecks);

    // Check 4: Invalid types
    const typeChecks = await this.checkTypes(generatedCode, knowledge);
    checks.push(...typeChecks);

    // Check 5: Wrong structure
    const structureChecks = await this.checkStructure(generatedCode, knowledge, context);
    checks.push(...structureChecks);

    // Check 6: Outdated APIs
    const apiChecks = await this.checkAPIs(generatedCode, knowledge);
    checks.push(...apiChecks);

    // Calculate score
    const score = this.calculateScore(checks);
    const hasHallucinations = score > 20; // Threshold

    // Generate suggestions
    const suggestions = this.generateSuggestions(checks, knowledge);

    return {
      hasHallucinations,
      score,
      checks,
      suggestions,
      confidence: this.calculateConfidence(checks),
    };
  }

  /**
   * Check for missing or incorrect imports
   */
  private async checkImports(
    code: string,
    knowledge: KnowledgeBase,
    context?: { file?: string; relatedFiles?: string[] }
  ): Promise<HallucinationCheck[]> {
    const checks: HallucinationCheck[] = [];

    // Extract imports from generated code
    const imports = this.extractImports(code);
    const importPaths = imports.map(imp => this.normalizeImport(imp));

    // Check against knowledge base
    const knownImports = new Set<string>();
    for (const [file, fileImports] of knowledge.relationships.imports.entries()) {
      for (const imp of fileImports) {
        knownImports.add(this.normalizeImport(imp));
      }
    }

    // Check each import
    for (const imp of imports) {
      const normalized = this.normalizeImport(imp);
      
      // Check if import exists in codebase
      if (!knownImports.has(normalized) && !this.isExternalPackage(imp)) {
        // Check if file actually exists
        const filePath = this.resolveImport(imp, context?.file);
        if (filePath && !await this.pathExists(filePath)) {
          checks.push({
            type: 'missing-import',
            severity: 'high',
            confidence: 0.9,
            detected: imp,
            expected: 'Valid import path',
            suggestion: `Import "${imp}" does not exist. Check if file exists or use correct path.`,
            evidence: [
              `File not found: ${filePath}`,
              'Import not in knowledge base',
            ],
          });
        }
      }
    }

    return checks;
  }

  /**
   * Check for wrong patterns
   */
  private async checkPatterns(
    code: string,
    knowledge: KnowledgeBase
  ): Promise<HallucinationCheck[]> {
    const checks: HallucinationCheck[] = [];

    // Generate DNA for generated code
    const codeDNA = codePatternDNA.generateDNA(code);

    // Find similar patterns in codebase
    const similar = codePatternDNA.findSimilar(codeDNA, 0.7);

    // Check if pattern matches project conventions
    const projectPatterns = knowledge.patterns || [];
    let matchesProjectPattern = false;

    for (const pattern of projectPatterns) {
      const patternDNA = codePatternDNA.generateDNA(pattern.examples[0] || '');
      const similarity = this.computeSimilarity(codeDNA, patternDNA);
      
      if (similarity > 0.8) {
        matchesProjectPattern = true;
        break;
      }
    }

    if (!matchesProjectPattern && similar.length === 0) {
      checks.push({
        type: 'wrong-pattern',
        severity: 'medium',
        confidence: 0.7,
        detected: 'Code pattern not matching project conventions',
        expected: 'Pattern matching project style',
        suggestion: 'Review project patterns and align generated code',
        evidence: [
          'Pattern not found in codebase',
          'Does not match project conventions',
        ],
      });
    }

    return checks;
  }

  /**
   * Check for fake endpoints
   */
  private async checkEndpoints(
    code: string,
    projectPath: string
  ): Promise<HallucinationCheck[]> {
    const checks: HallucinationCheck[] = [];

    // Extract API calls
    const apiCalls = this.extractAPICalls(code);

    for (const call of apiCalls) {
      // Check if endpoint is registered
      const isValid = await apiValidator.validateEndpoint(call.endpoint, call.method);
      
      if (!isValid) {
        checks.push({
          type: 'fake-endpoint',
          severity: 'critical',
          confidence: 0.95,
          detected: `${call.method} ${call.endpoint}`,
          expected: 'Registered API endpoint',
          suggestion: `Endpoint "${call.endpoint}" is not registered. Use apiValidator.registerEndpoint() first.`,
          evidence: [
            'Endpoint not in API validator',
            'May be a hallucinated endpoint',
          ],
        });
      }
    }

    return checks;
  }

  /**
   * Check for invalid types
   */
  private async checkTypes(
    code: string,
    knowledge: KnowledgeBase
  ): Promise<HallucinationCheck[]> {
    const checks: HallucinationCheck[] = [];

    // Extract type references
    const types = this.extractTypes(code);

    // Check against knowledge base types
    const knownTypes = new Set<string>();
    // In production, extract from knowledge base

    for (const type of types) {
      if (!knownTypes.has(type) && !this.isBuiltinType(type)) {
        checks.push({
          type: 'invalid-type',
          severity: 'high',
          confidence: 0.8,
          detected: type,
          expected: 'Valid type from codebase',
          suggestion: `Type "${type}" not found in codebase. Check if it exists or needs to be imported.`,
          evidence: [
            'Type not in knowledge base',
            'May be hallucinated',
          ],
        });
      }
    }

    return checks;
  }

  /**
   * Check for wrong structure
   */
  private async checkStructure(
    code: string,
    knowledge: KnowledgeBase,
    context?: { file?: string }
  ): Promise<HallucinationCheck[]> {
    const checks: HallucinationCheck[] = [];

    if (!context?.file) return checks;

    // Check file location matches structure
    const filePath = context.file;
    const structure = knowledge.architecture.structure;

    // Check if file is in correct location based on type
    if (filePath.includes('/components/') && !code.includes('export') && !code.includes('function')) {
      checks.push({
        type: 'wrong-structure',
        severity: 'medium',
        confidence: 0.7,
        detected: 'Component file without proper exports',
        expected: 'Component with proper exports',
        suggestion: 'Components should export React components',
        evidence: [
          'File in components directory',
          'Missing component structure',
        ],
      });
    }

    return checks;
  }

  /**
   * Check for outdated APIs
   */
  private async checkAPIs(
    code: string,
    knowledge: KnowledgeBase
  ): Promise<HallucinationCheck[]> {
    const checks: HallucinationCheck[] = [];

    // Check for deprecated patterns
    const deprecatedPatterns = [
      { pattern: /componentWillMount/g, replacement: 'useEffect' },
      { pattern: /componentWillReceiveProps/g, replacement: 'useEffect' },
      { pattern: /\.then\(/g, replacement: 'async/await' },
    ];

    for (const dep of deprecatedPatterns) {
      if (dep.pattern.test(code)) {
        checks.push({
          type: 'outdated-api',
          severity: 'medium',
          confidence: 0.8,
          detected: dep.pattern.toString(),
          expected: dep.replacement,
          suggestion: `Replace deprecated pattern with ${dep.replacement}`,
          evidence: [
            'Deprecated API usage detected',
            'Project uses modern patterns',
          ],
        });
      }
    }

    return checks;
  }

  /**
   * Calculate hallucination score
   */
  private calculateScore(checks: HallucinationCheck[]): number {
    let score = 0;
    for (const check of checks) {
      const weight = check.severity === 'critical' ? 20 :
                     check.severity === 'high' ? 15 :
                     check.severity === 'medium' ? 10 : 5;
      score += weight * check.confidence;
    }
    return Math.min(100, score);
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(checks: HallucinationCheck[]): number {
    if (checks.length === 0) return 1.0;
    const avgConfidence = checks.reduce((sum, c) => sum + c.confidence, 0) / checks.length;
    return avgConfidence;
  }

  /**
   * Generate suggestions
   */
  private generateSuggestions(checks: HallucinationCheck[], knowledge: any): string[] {
    const suggestions: string[] = [];

    if (checks.length === 0) {
      suggestions.push('✅ No hallucinations detected!');
      return suggestions;
    }

    const critical = checks.filter(c => c.severity === 'critical');
    if (critical.length > 0) {
      suggestions.push(`⚠️ ${critical.length} critical issue(s) found - review before using`);
    }

    const byType = new Map<string, number>();
    for (const check of checks) {
      byType.set(check.type, (byType.get(check.type) || 0) + 1);
    }

    for (const [type, count] of byType.entries()) {
      suggestions.push(`${count} ${type} issue(s) detected`);
    }

    return suggestions;
  }

  // Helper methods
  private extractImports(code: string): string[] {
    const imports: string[] = [];
    const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  private extractAPICalls(code: string): Array<{ method: string; endpoint: string }> {
    const calls: Array<{ method: string; endpoint: string }> = [];
    const patterns = [
      { regex: /fetch\(['"]([^'"]+)['"]/g, method: 'GET' },
      { regex: /\.get\(['"]([^'"]+)['"]/g, method: 'GET' },
      { regex: /\.post\(['"]([^'"]+)['"]/g, method: 'POST' },
      { regex: /\.put\(['"]([^'"]+)['"]/g, method: 'PUT' },
      { regex: /\.delete\(['"]([^'"]+)['"]/g, method: 'DELETE' },
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(code)) !== null) {
        calls.push({ method: pattern.method, endpoint: match[1] });
      }
    }

    return calls;
  }

  private extractTypes(code: string): string[] {
    const types: string[] = [];
    const typeRegex = /:\s*([A-Z][a-zA-Z0-9<>[\]]+)/g;
    let match;
    while ((match = typeRegex.exec(code)) !== null) {
      types.push(match[1]);
    }
    return types;
  }

  private normalizeImport(imp: string): string {
    return imp.replace(/^\.\//, '').replace(/\/index$/, '');
  }

  private resolveImport(imp: string, fromFile?: string): string | null {
    if (!fromFile) return null;
    if (imp.startsWith('.')) {
      return path.resolve(path.dirname(fromFile), imp);
    }
    return null;
  }

  private isExternalPackage(imp: string): boolean {
    return !imp.startsWith('.') && !imp.startsWith('/');
  }

  private isBuiltinType(type: string): boolean {
    return ['string', 'number', 'boolean', 'object', 'any', 'void', 'null', 'undefined'].includes(type);
  }

  private computeSimilarity(dna1: any, dna2: any): number {
    // Simplified similarity
    return 0.5;
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

export const hallucinationDetector = new HallucinationDetector();

