/**
 * Verification Engine - Anti-Hallucination System
 * 
 * Validates all extracted information against actual source code to prevent
 * AI hallucinations when reading MDC files.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';
import { ComponentSpec, RelationshipSpec, PatternSpec } from './mdc-generator';

export interface VerificationResult {
  isValid: boolean;
  confidence: number;
  issues: VerificationIssue[];
  evidence: Evidence[];
  warnings: string[];
}

export interface VerificationIssue {
  type: 'missing' | 'incorrect' | 'ambiguous' | 'outdated' | 'unsupported';
  severity: 'error' | 'warning' | 'info';
  component: string;
  field: string;
  expected?: any;
  actual?: any;
  source: string;
  line?: number;
}

export interface Evidence {
  type: 'code' | 'import' | 'usage' | 'comment' | 'type';
  file: string;
  line: number;
  snippet: string;
  relevance: number;
}

export class VerificationEngine {
  private projectPath: string;
  private program: ts.Program | null = null;
  private checker: ts.TypeChecker | null = null;
  private sourceFiles: Map<string, string> = new Map();
  private verificationCache: Map<string, VerificationResult> = new Map();

  constructor(projectPath: string, program?: ts.Program, checker?: ts.TypeChecker) {
    this.projectPath = projectPath;
    this.program = program || null;
    this.checker = checker || null;
  }

  /**
   * Verify a component specification against actual source code
   */
  async verifyComponent(component: ComponentSpec): Promise<VerificationResult> {
    const cacheKey = `${component.path}::${component.name}`;
    if (this.verificationCache.has(cacheKey)) {
      return this.verificationCache.get(cacheKey)!;
    }

    const issues: VerificationIssue[] = [];
    const evidence: Evidence[] = [];
    const warnings: string[] = [];

    const filePath = path.join(this.projectPath, component.path);
    const sourceCode = await this.loadSourceCode(filePath);

    if (!sourceCode) {
      const result: VerificationResult = {
        isValid: false,
        confidence: 0,
        issues: [{
          type: 'missing',
          severity: 'error',
          component: component.name,
          field: 'file',
          expected: component.path,
          actual: 'not found',
          source: 'verification',
        }],
        evidence: [],
        warnings: ['Source file not found'],
      };
      this.verificationCache.set(cacheKey, result);
      return result;
    }

    // Verify component exists
    const existenceCheck = this.verifyExistence(component, sourceCode, filePath);
    issues.push(...existenceCheck.issues);
    evidence.push(...existenceCheck.evidence);

    // Verify type (class, function, interface, etc.)
    const typeCheck = this.verifyType(component, sourceCode, filePath);
    issues.push(...typeCheck.issues);
    evidence.push(...typeCheck.evidence);

    // Verify methods/properties
    if (component.methods) {
      const methodsCheck = await this.verifyMethods(component, sourceCode, filePath);
      issues.push(...methodsCheck.issues);
      evidence.push(...methodsCheck.evidence);
    }

    if (component.properties) {
      const propertiesCheck = await this.verifyProperties(component, sourceCode, filePath);
      issues.push(...propertiesCheck.issues);
      evidence.push(...propertiesCheck.evidence);
    }

    // Verify dependencies
    const dependenciesCheck = await this.verifyDependencies(component, sourceCode, filePath);
    issues.push(...dependenciesCheck.issues);
    evidence.push(...dependenciesCheck.evidence);
    warnings.push(...dependenciesCheck.warnings);

    // Verify purpose (if from JSDoc)
    const purposeCheck = this.verifyPurpose(component, sourceCode, filePath);
    if (purposeCheck) {
      evidence.push(...purposeCheck.evidence);
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(issues, evidence, warnings);
    const isValid = issues.filter(i => i.severity === 'error').length === 0;

    const result: VerificationResult = {
      isValid,
      confidence,
      issues,
      evidence,
      warnings,
    };

    this.verificationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Verify a relationship exists in source code
   */
  async verifyRelationship(relationship: RelationshipSpec, components: ComponentSpec[]): Promise<VerificationResult> {
    const fromComponent = components.find(c => c.name === relationship.from);
    const toComponent = components.find(c => c.name === relationship.to);

    if (!fromComponent || !toComponent) {
      return {
        isValid: false,
        confidence: 0,
        issues: [{
          type: 'missing',
          severity: 'error',
          component: relationship.from,
          field: 'relationship',
          expected: `relationship to ${relationship.to}`,
          actual: 'component not found',
          source: 'verification',
        }],
        evidence: [],
        warnings: [],
      };
    }

    const fromPath = path.join(this.projectPath, fromComponent.path);
    const sourceCode = await this.loadSourceCode(fromPath);

    if (!sourceCode) {
      return {
        isValid: false,
        confidence: 0,
        issues: [{
          type: 'missing',
          severity: 'error',
          component: relationship.from,
          field: 'file',
          expected: fromComponent.path,
          actual: 'not found',
          source: 'verification',
        }],
        evidence: [],
        warnings: [],
      };
    }

    const issues: VerificationIssue[] = [];
    const evidence: Evidence[] = [];
    const warnings: string[] = [];

    // Check for actual import/usage
    const relationshipType = relationship.type;
    let found = false;

    if (relationshipType === 'imports') {
      // Check if toComponent is imported
      const importPatterns = this.getImportPatterns(toComponent);
      for (const pattern of importPatterns) {
        if (sourceCode.includes(pattern)) {
          const lines = sourceCode.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(pattern)) {
              evidence.push({
                type: 'import',
                file: fromComponent.path,
                line: i + 1,
                snippet: lines[i].trim(),
                relevance: 1.0,
              });
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
    }

    if (!found) {
      issues.push({
        type: 'incorrect',
        severity: 'error',
        component: relationship.from,
        field: 'relationship',
        expected: `${relationshipType} relationship to ${relationship.to}`,
        actual: 'not found in source',
        source: fromComponent.path,
      });
    }

    // Verify relationship strength matches actual usage frequency
    const usageCount = this.countUsages(sourceCode, toComponent.name);
    const expectedStrength = this.getExpectedStrength(usageCount);

    if (relationship.strength !== expectedStrength && usageCount > 0) {
      warnings.push(
        `Relationship strength mismatch: marked as ${relationship.strength}, but usage frequency suggests ${expectedStrength}`
      );
    }

    const confidence = found ? (usageCount > 0 ? 0.95 : 0.7) : 0;

    return {
      isValid: found,
      confidence,
      issues,
      evidence,
      warnings,
    };
  }

  /**
   * Verify a detected pattern actually exists
   */
  async verifyPattern(pattern: PatternSpec, components: ComponentSpec[]): Promise<VerificationResult> {
    const issues: VerificationIssue[] = [];
    const evidence: Evidence[] = [];
    const warnings: string[] = [];

    // Check each example file
    for (const exampleFile of pattern.examples) {
      const fullPath = path.join(this.projectPath, exampleFile);
      const sourceCode = await this.loadSourceCode(fullPath);

      if (!sourceCode) {
        issues.push({
          type: 'missing',
          severity: 'warning',
          component: pattern.name,
          field: 'example',
          expected: exampleFile,
          actual: 'not found',
          source: 'verification',
        });
        continue;
      }

      // Verify pattern indicators exist
      const patternIndicators = this.getPatternIndicators(pattern.name);
      let foundIndicators = 0;

      for (const indicator of patternIndicators) {
        if (sourceCode.includes(indicator.keyword) || 
            new RegExp(indicator.pattern || '', 'i').test(sourceCode)) {
          const lines = sourceCode.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(indicator.keyword) || 
                (indicator.pattern && new RegExp(indicator.pattern, 'i').test(lines[i]))) {
              evidence.push({
                type: 'code',
                file: exampleFile,
                line: i + 1,
                snippet: lines[i].trim(),
                relevance: indicator.relevance,
              });
              foundIndicators++;
              break;
            }
          }
        }
      }

      if (foundIndicators === 0) {
        warnings.push(`No pattern indicators found in ${exampleFile}`);
      }
    }

    // Verify frequency matches evidence count
    const actualFrequency = evidence.length;
    if (actualFrequency !== pattern.frequency) {
      warnings.push(
        `Pattern frequency mismatch: claimed ${pattern.frequency}, but found ${actualFrequency} occurrences`
      );
    }

    // Recalculate confidence based on evidence
    const evidenceBasedConfidence = Math.min((evidence.length / Math.max(pattern.examples.length, 1)) * 100, 100);
    const confidence = Math.min((evidenceBasedConfidence + pattern.confidence) / 2, 100) / 100;

    return {
      isValid: evidence.length > 0,
      confidence,
      issues,
      evidence,
      warnings,
    };
  }

  /**
   * Verify component exists in source code
   */
  private verifyExistence(
    component: ComponentSpec,
    sourceCode: string,
    filePath: string
  ): { issues: VerificationIssue[]; evidence: Evidence[] } {
    const issues: VerificationIssue[] = [];
    const evidence: Evidence[] = [];

    // Check for component declaration
    const patterns = [
      new RegExp(`(?:export\\s+)?(?:default\\s+)?class\\s+${component.name}\\b`, 'm'),
      new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${component.name}\\b`, 'm'),
      new RegExp(`(?:export\\s+)?(?:const|let|var)\\s+${component.name}\\s*[:=]`, 'm'),
      new RegExp(`(?:export\\s+)?interface\\s+${component.name}\\b`, 'm'),
      new RegExp(`(?:export\\s+)?type\\s+${component.name}\\b`, 'm'),
    ];

    let found = false;
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of patterns) {
        if (pattern.test(lines[i])) {
          evidence.push({
            type: 'code',
            file: component.path,
            line: i + 1,
            snippet: lines[i].trim(),
            relevance: 1.0,
          });
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      issues.push({
        type: 'missing',
        severity: 'error',
        component: component.name,
        field: 'existence',
        expected: `component ${component.name} to exist`,
        actual: 'not found in source',
        source: component.path,
      });
    }

    return { issues, evidence };
  }

  /**
   * Verify component type matches actual code
   */
  private verifyType(
    component: ComponentSpec,
    sourceCode: string,
    filePath: string
  ): { issues: VerificationIssue[]; evidence: Evidence[] } {
    const issues: VerificationIssue[] = [];
    const evidence: Evidence[] = [];

    const lines = sourceCode.split('\n');
    let actualType: ComponentSpec['type'] | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes(`class ${component.name}`) || line.includes(`class ${component.name}<`)) {
        actualType = 'class';
        evidence.push({
          type: 'code',
          file: component.path,
          line: i + 1,
          snippet: line.trim(),
          relevance: 1.0,
        });
        break;
      } else if (line.includes(`function ${component.name}`) || line.includes(`async function ${component.name}`)) {
        actualType = 'function';
        evidence.push({
          type: 'code',
          file: component.path,
          line: i + 1,
          snippet: line.trim(),
          relevance: 1.0,
        });
        break;
      } else if (line.includes(`interface ${component.name}`) || line.includes(`interface ${component.name}<`)) {
        actualType = 'interface';
        evidence.push({
          type: 'code',
          file: component.path,
          line: i + 1,
          snippet: line.trim(),
          relevance: 1.0,
        });
        break;
      } else if (line.includes(`type ${component.name}`) || line.includes(`type ${component.name}<`)) {
        actualType = 'type';
        evidence.push({
          type: 'code',
          file: component.path,
          line: i + 1,
          snippet: line.trim(),
          relevance: 1.0,
        });
        break;
      }
    }

    if (actualType && actualType !== component.type) {
      issues.push({
        type: 'incorrect',
        severity: 'error',
        component: component.name,
        field: 'type',
        expected: component.type,
        actual: actualType,
        source: component.path,
      });
    }

    return { issues, evidence };
  }

  /**
   * Verify methods exist in class
   */
  private async verifyMethods(
    component: ComponentSpec,
    sourceCode: string,
    filePath: string
  ): Promise<{ issues: VerificationIssue[]; evidence: Evidence[] }> {
    const issues: VerificationIssue[] = [];
    const evidence: Evidence[] = [];

    if (component.type !== 'class') {
      return { issues, evidence };
    }

    const lines = sourceCode.split('\n');
    
    for (const methodName of component.methods || []) {
      let found = false;
      
      // Check for method declaration (various formats)
      const methodPatterns = [
        new RegExp(`${methodName}\\s*\\(`, 'm'),
        new RegExp(`${methodName}\\s*=\\s*\\(`, 'm'),
        new RegExp(`${methodName}\\s*:\\s*\\(`, 'm'),
        new RegExp(`get\\s+${methodName}\\s*\\(`, 'm'),
        new RegExp(`set\\s+${methodName}\\s*\\(`, 'm'),
        new RegExp(`async\\s+${methodName}\\s*\\(`, 'm'),
      ];

      for (let i = 0; i < lines.length; i++) {
        for (const pattern of methodPatterns) {
          if (pattern.test(lines[i]) && lines[i].includes(component.name)) {
            evidence.push({
              type: 'code',
              file: component.path,
              line: i + 1,
              snippet: lines[i].trim(),
              relevance: 0.9,
            });
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        issues.push({
          type: 'missing',
          severity: 'warning',
          component: component.name,
          field: 'method',
          expected: `method ${methodName}`,
          actual: 'not found in class',
          source: component.path,
        });
      }
    }

    return { issues, evidence };
  }

  /**
   * Verify properties exist in class
   */
  private async verifyProperties(
    component: ComponentSpec,
    sourceCode: string,
    filePath: string
  ): Promise<{ issues: VerificationIssue[]; evidence: Evidence[] }> {
    const issues: VerificationIssue[] = [];
    const evidence: Evidence[] = [];

    if (component.type !== 'class' && component.type !== 'interface' && component.type !== 'type') {
      return { issues, evidence };
    }

    const lines = sourceCode.split('\n');
    
    for (const propName of component.properties || []) {
      let found = false;
      
      // Check for property declaration
      const propPatterns = [
        new RegExp(`${propName}\\s*[:=]`, 'm'),
        new RegExp(`\\b${propName}\\s*[?!]?:`, 'm'),
        new RegExp(`private\\s+${propName}`, 'm'),
        new RegExp(`public\\s+${propName}`, 'm'),
        new RegExp(`protected\\s+${propName}`, 'm'),
      ];

      for (let i = 0; i < lines.length; i++) {
        for (const pattern of propPatterns) {
          if (pattern.test(lines[i])) {
            evidence.push({
              type: 'code',
              file: component.path,
              line: i + 1,
              snippet: lines[i].trim(),
              relevance: 0.9,
            });
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        issues.push({
          type: 'missing',
          severity: 'warning',
          component: component.name,
          field: 'property',
          expected: `property ${propName}`,
          actual: 'not found',
          source: component.path,
        });
      }
    }

    return { issues, evidence };
  }

  /**
   * Verify dependencies are actually imported
   */
  private async verifyDependencies(
    component: ComponentSpec,
    sourceCode: string,
    filePath: string
  ): Promise<{ issues: VerificationIssue[]; evidence: Evidence[]; warnings: string[] }> {
    const issues: VerificationIssue[] = [];
    const evidence: Evidence[] = [];
    const warnings: string[] = [];

    const lines = sourceCode.split('\n');
    const imports = new Set<string>();

    // Extract all imports from source
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const importMatch = line.match(/from\s+['"](.+?)['"]/);
      if (importMatch) {
        imports.add(importMatch[1]);
      }
    }

    // Verify each declared dependency
    for (const dep of component.dependencies) {
      // Check if dependency is imported (exact match or module match)
      const depModule = dep.split('/')[0];
      let found = imports.has(dep);
      
      if (!found) {
        // Check for module-level match (e.g., '@guardrail/security' matches '@guardrail/security/auth')
        found = Array.from(imports).some(imp => 
          imp.startsWith(dep) || dep.startsWith(imp) || 
          imp.split('/')[0] === depModule
        );
      }

      if (found) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(dep) && lines[i].includes('import')) {
            evidence.push({
              type: 'import',
              file: component.path,
              line: i + 1,
              snippet: lines[i].trim(),
              relevance: 0.8,
            });
            break;
          }
        }
      } else {
        warnings.push(`Dependency ${dep} declared but not found in imports`);
      }
    }

    return { issues, evidence, warnings };
  }

  /**
   * Verify purpose from JSDoc comments
   */
  private verifyPurpose(
    component: ComponentSpec,
    sourceCode: string,
    filePath: string
  ): { evidence: Evidence[] } | null {
    if (!component.purpose || component.purpose === 'Component extracted from codebase') {
      return null;
    }

    const evidence: Evidence[] = [];
    const lines = sourceCode.split('\n');
    
    // Find JSDoc comment before component
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(component.name)) {
        // Look backwards for comments
        for (let j = Math.max(0, i - 10); j < i; j++) {
          if (lines[j].includes('/**') || lines[j].includes('*') || lines[j].includes('//')) {
            if (lines[j].includes(component.purpose.substring(0, 20))) {
              evidence.push({
                type: 'comment',
                file: component.path,
                line: j + 1,
                snippet: lines[j].trim(),
                relevance: 0.7,
              });
              break;
            }
          }
        }
        break;
      }
    }

    return { evidence };
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    issues: VerificationIssue[],
    evidence: Evidence[],
    warnings: string[]
  ): number {
    let confidence = 1.0;

    // Deduct for errors
    const errorCount = issues.filter(i => i.severity === 'error').length;
    confidence -= errorCount * 0.3;

    // Deduct for warnings
    const warningCount = issues.filter(i => i.severity === 'warning').length + warnings.length;
    confidence -= warningCount * 0.1;

    // Boost for evidence
    if (evidence.length > 0) {
      const avgRelevance = evidence.reduce((sum, e) => sum + e.relevance, 0) / evidence.length;
      confidence = Math.max(confidence, avgRelevance);
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get import patterns for a component
   */
  private getImportPatterns(component: ComponentSpec): string[] {
    const patterns: string[] = [];
    const baseName = component.name;
    const fileBase = path.basename(component.path, path.extname(component.path));
    
    // Direct name match
    patterns.push(baseName);
    
    // File-based import
    patterns.push(`from '${component.path}'`);
    patterns.push(`from "${component.path}"`);
    patterns.push(`from './${path.relative(path.dirname(component.path), component.path)}'`);
    
    // Module-based import
    if (component.path.includes('/')) {
      const parts = component.path.split('/');
      const modulePath = parts.slice(0, -1).join('/');
      patterns.push(`from '${modulePath}'`);
    }

    return patterns;
  }

  /**
   * Count usages of a component name in source
   */
  private countUsages(sourceCode: string, componentName: string): number {
    const regex = new RegExp(`\\b${componentName}\\b`, 'g');
    const matches = sourceCode.match(regex);
    return matches ? matches.length : 0;
  }

  /**
   * Get expected relationship strength based on usage
   */
  private getExpectedStrength(usageCount: number): 'strong' | 'medium' | 'weak' {
    if (usageCount > 5) return 'strong';
    if (usageCount > 1) return 'medium';
    return 'weak';
  }

  /**
   * Get pattern indicators for a pattern name
   */
  private getPatternIndicators(patternName: string): Array<{ keyword: string; pattern?: string; relevance: number }> {
    const indicators: Record<string, Array<{ keyword: string; pattern?: string; relevance: number }>> = {
      'Repository Pattern': [
        { keyword: 'Repository', relevance: 1.0 },
        { keyword: 'repo', relevance: 0.8 },
        { pattern: 'class.*Repository', relevance: 0.9 },
      ],
      'Service Layer': [
        { keyword: 'Service', relevance: 1.0 },
        { keyword: 'service', relevance: 0.8 },
        { pattern: 'class.*Service', relevance: 0.9 },
      ],
      'Factory Pattern': [
        { keyword: 'Factory', relevance: 1.0 },
        { keyword: 'create', relevance: 0.6 },
        { pattern: 'create[A-Z]', relevance: 0.7 },
      ],
      'Singleton Pattern': [
        { keyword: 'getInstance', relevance: 1.0 },
        { keyword: 'singleton', relevance: 0.9 },
      ],
      'Observer Pattern': [
        { keyword: 'subscribe', relevance: 0.9 },
        { keyword: 'emit', relevance: 0.9 },
        { keyword: 'on(', relevance: 0.8 },
      ],
      'Strategy Pattern': [
        { keyword: 'Strategy', relevance: 1.0 },
        { keyword: 'strategy', relevance: 0.8 },
      ],
    };

    return indicators[patternName] || [];
  }

  /**
   * Load source code with caching
   */
  private async loadSourceCode(filePath: string): Promise<string | null> {
    if (this.sourceFiles.has(filePath)) {
      return this.sourceFiles.get(filePath)!;
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      this.sourceFiles.set(filePath, content);
      return content;
    } catch {
      return null;
    }
  }
}

