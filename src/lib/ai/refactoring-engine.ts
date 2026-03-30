import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export interface RefactoringSuggestion {
  id: string;
  type: RefactoringType;
  title: string;
  description: string;
  filePath: string;
  location: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
  originalCode: string;
  refactoredCode: string;
  benefits: string[];
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  confidence: number;
  prerequisites: string[];
  risks: string[];
  automated: boolean;
  metadata: {
    complexity: number;
    maintainabilityGain: number;
    performanceGain: number;
    testCoverage: number;
  };
}

export type RefactoringType = 
  | 'extract_method'
  | 'extract_class'
  | 'extract_interface'
  | 'extract_variable'
  | 'inline_method'
  | 'inline_variable'
  | 'move_method'
  | 'move_field'
  | 'rename_method'
  | 'rename_variable'
  | 'replace_conditional_with_polymorphism'
  | 'replace_magic_number'
  | 'replace_nested_conditional'
  | 'introduce_parameter_object'
  | 'replace_array_with_object'
  | 'decompose_conditional'
  | 'consolidate_conditional'
  | 'replace_loop_with_pipeline'
  | 'split_loop'
  | 'remove_dead_code'
  | 'simplify_conditional'
  | 'reduce_parameter_count'
  | 'replace_type_code_with_subclasses'
  | 'extract_superclass'
  | 'form_template_method'
  | 'replace_inheritance_with_delegation'
  | 'replace_delegation_with_inheritance';

export interface CodeAnalysis {
  filePath: string;
  language: string;
  metrics: CodeMetrics;
  smells: CodeSmell[];
  complexity: ComplexityMetrics;
  duplications: Duplication[];
  dependencies: Dependency[];
  issues: Issue[];
}

export interface CodeMetrics {
  linesOfCode: number;
  sourceLinesOfCode: number;
  commentLines: number;
  blankLines: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  technicalDebt: number;
  testCoverage: number;
  duplication: number;
}

export interface CodeSmell {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  location: {
    line: number;
    column: number;
  };
  suggestion?: string;
}

export interface ComplexityMetrics {
  overall: number;
  functions: FunctionComplexity[];
  classes: ClassComplexity[];
}

export interface FunctionComplexity {
  name: string;
  line: number;
  complexity: number;
  parameters: number;
  nesting: number;
}

export interface ClassComplexity {
  name: string;
  line: number;
  complexity: number;
  methods: number;
  fields: number;
  coupling: number;
}

export interface Duplication {
  type: 'exact' | 'similar';
  lines: number;
  occurrences: {
    filePath: string;
    startLine: number;
    endLine: number;
  }[];
  similarity: number;
}

export interface Dependency {
  type: 'import' | 'function_call' | 'class_inheritance' | 'interface_implementation';
  from: string;
  to: string;
  strength: 'weak' | 'medium' | 'strong';
}

export interface Issue {
  type: 'error' | 'warning' | 'info';
  message: string;
  rule: string;
  location: {
    line: number;
    column: number;
  };
  fixable: boolean;
}

export interface RefactoringPlan {
  id: string;
  name: string;
  description: string;
  suggestions: RefactoringSuggestion[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort: number;
  expectedBenefits: {
    maintainability: number;
    performance: number;
    testability: number;
    readability: number;
  };
  dependencies: string[];
  risks: string[];
}

export class AutomatedRefactoringEngine extends EventEmitter {
  private analysisCache: Map<string, CodeAnalysis> = new Map();
  private refactoringRules: Map<RefactoringType, RefactoringRule> = new Map();
  private patterns: Map<string, RefactoringPattern> = new Map();
  private history: RefactoringSuggestion[] = [];

  constructor() {
    super();
    this.initializeRules();
    this.initializePatterns();
  }

  private initializeRules(): void {
    this.refactoringRules.set('extract_method', {
      name: 'Extract Method',
      description: 'Extract a complex code fragment into a separate method',
      conditions: [
        'method_length > 20',
        'cyclomatic_complexity > 10',
        'repeated_code_blocks > 2',
      ],
      benefits: ['improved readability', 'better reusability', 'easier testing'],
      effort: 'medium',
      automated: true,
    });

    this.refactoringRules.set('extract_class', {
      name: 'Extract Class',
      description: 'Extract related functionality into a separate class',
      conditions: [
        'class_responsibilities > 1',
        'class_methods > 20',
        'class_fields > 15',
      ],
      benefits: ['single responsibility', 'better encapsulation', 'improved cohesion'],
      effort: 'high',
      automated: false,
    });

    this.refactoringRules.set('replace_magic_number', {
      name: 'Replace Magic Number',
      description: 'Replace magic numbers with named constants',
      conditions: [
        'magic_numbers_present',
        'number_not_self_explanatory',
      ],
      benefits: ['improved readability', 'easier maintenance', 'reduced errors'],
      effort: 'low',
      automated: true,
    });

    this.refactoringRules.set('remove_dead_code', {
      name: 'Remove Dead Code',
      description: 'Remove unused code elements',
      conditions: [
        'unused_functions',
        'unused_variables',
        'unreachable_code',
      ],
      benefits: ['reduced complexity', 'smaller codebase', 'faster compilation'],
      effort: 'low',
      automated: true,
    });

    this.refactoringRules.set('simplify_conditional', {
      name: 'Simplify Conditional',
      description: 'Simplify complex conditional expressions',
      conditions: [
        'nested_conditionals > 3',
        'conditional_complexity > 10',
        'boolean_expression_complex',
      ],
      benefits: ['improved readability', 'reduced cognitive load', 'easier testing'],
      effort: 'medium',
      automated: true,
    });
  }

  private initializePatterns(): void {
    this.patterns.set('long_parameter_list', {
      name: 'Long Parameter List',
      pattern: /function\s+\w+\([^)]{100,}\)/,
      refactoringType: 'introduce_parameter_object',
      description: 'Function has too many parameters',
    });

    this.patterns.set('large_class', {
      name: 'Large Class',
      pattern: /class\s+\w+\s*{[\s\S]{500,}}/,
      refactoringType: 'extract_class',
      description: 'Class is too large and has too many responsibilities',
    });

    this.patterns.set('duplicate_code', {
      name: 'Duplicate Code',
      pattern: /(\w+\s*\([^)]*\)\s*{[^}]+})\s*\1/,
      refactoringType: 'extract_method',
      description: 'Duplicate code blocks detected',
    });

    this.patterns.set('complex_conditional', {
      name: 'Complex Conditional',
      pattern: /if\s*\([^)]{50,}\)\s*{[^}]*if\s*\(/,
      refactoringType: 'simplify_conditional',
      description: 'Complex nested conditional detected',
    });
  }

  /**
   * Analyze code for metrics, smells, complexity, duplications, dependencies, and issues
   * @param code - The source code to analyze
   * @param filePath - The file path (used for language detection and caching)
   * @returns Comprehensive code analysis results
   */
  async analyze(code: string, filePath: string): Promise<CodeAnalysis> {
    // Check cache first
    const cacheKey = this.generateCacheKey(code, filePath);
    const cached = this.analysisCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const analysis = await this.performAnalysis(code, filePath);
    
    // Cache the result
    this.analysisCache.set(cacheKey, analysis);
    
    // Emit event for listeners
    this.emit('analysis:complete', analysis);
    
    return analysis;
  }
  
  private async performAnalysis(code: string, filePath: string): Promise<CodeAnalysis> {
    const language = this.detectLanguage(filePath);
    
    // Run all analysis in parallel for performance
    const [metrics, smells, complexity, duplications, dependencies, issues] = await Promise.all([
      this.calculateMetrics(code),
      this.detectCodeSmells(code),
      this.analyzeComplexity(code),
      this.findDuplications(code),
      this.analyzeDependencies(code),
      this.analyzeIssues(code),
    ]);
    
    return {
      filePath,
      language,
      metrics,
      smells,
      complexity,
      duplications,
      dependencies,
      issues,
    };
  }
  
  /**
   * Get refactoring suggestions for the given code
   * @param code - The source code to analyze
   * @param filePath - The file path
   * @returns Array of refactoring suggestions
   */
  async getSuggestions(code: string, filePath: string): Promise<RefactoringSuggestion[]> {
    const analysis = await this.analyze(code, filePath);
    const suggestions: RefactoringSuggestion[] = [];
    
    // Check each refactoring rule
    for (const [type, rule] of this.refactoringRules) {
      if (this.shouldApplyRefactoring(analysis, rule)) {
        const suggestion = await this.createSuggestion(type, analysis, rule);
        suggestions.push(suggestion);
        this.history.push(suggestion);
      }
    }
    
    // Check patterns
    for (const [_name, pattern] of this.patterns) {
      const matches = this.findPatternMatches(code, pattern);
      for (const match of matches) {
        const suggestion = await this.createPatternSuggestion(pattern, match, analysis);
        suggestions.push(suggestion);
        this.history.push(suggestion);
      }
    }
    
    // Sort by impact and confidence
    suggestions.sort((a, b) => {
      const impactWeight = this.getImpactWeight(b.impact) - this.getImpactWeight(a.impact);
      if (impactWeight !== 0) return impactWeight;
      return b.confidence - a.confidence;
    });
    
    this.emit('suggestions:generated', suggestions);
    
    return suggestions;
  }
  
  private findPatternMatches(code: string, pattern: RefactoringPattern): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const lines = code.split('\\n');
    
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      const match = pattern.pattern.exec(line);
      if (match) {
        matches.push({
          line: lineNum,
          column: match.index || 0,
          code: match[0],
        });
      }
    }
    
    return matches;
  }
  
  /**
   * Create a refactoring plan from suggestions
   * @param suggestions - Array of refactoring suggestions
   * @param name - Name for the plan
   * @returns A structured refactoring plan
   */
  createPlan(suggestions: RefactoringSuggestion[], name: string): RefactoringPlan {
    return {
      id: this.generatePlanId(),
      name,
      description: `Refactoring plan with ${suggestions.length} suggestions`,
      suggestions,
      priority: this.calculatePlanPriority(suggestions),
      estimatedEffort: this.calculateTotalEffort(suggestions),
      expectedBenefits: this.calculateExpectedBenefits(suggestions),
      dependencies: this.identifyDependencies(suggestions),
      risks: this.identifyRisks(suggestions),
    };
  }
  
  /**
   * Clear the analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
  }
  
  /**
   * Get analysis from cache if available
   */
  getCachedAnalysis(code: string, filePath: string): CodeAnalysis | undefined {
    const cacheKey = this.generateCacheKey(code, filePath);
    return this.analysisCache.get(cacheKey);
  }

  private async extractMethod(code: string, suggestion: RefactoringSuggestion): Promise<{
    code: string;
    changes: CodeChange[];
  }> {
    const changes: CodeChange[] = [];
    
    const methodName = this.generateMethodName(suggestion.description);
    const extractedCode = code.slice(
      suggestion.location.startLine - 1,
      suggestion.location.endLine
    );

    const newMethod = `private ${methodName}() {\n${extractedCode}\n}`;
    const methodCall = `${methodName}();`;

    const lines = code.split('\n');
    const startIndex = suggestion.location.startLine - 1;
    const deleteCount = suggestion.location.endLine - suggestion.location.startLine + 1;
    lines.splice(startIndex, deleteCount, methodCall);
    lines.push(newMethod);

    changes.push({
      type: 'add',
      line: lines.length - 1,
      description: `Extracted method: ${methodName}`,
    });

    changes.push({
      type: 'replace',
      line: suggestion.location.startLine,
      description: 'Replaced with method call',
    });

    return {
      code: lines.join('\n'),
      changes,
    };
  }

  private async replaceMagicNumbers(code: string, _suggestion: RefactoringSuggestion): Promise<{
    code: string;
    changes: CodeChange[];
  }> {
    const changes: CodeChange[] = [];
    let modifiedCode = code;

    const magicNumberPattern = /\b(\d{2,})\b/g;
    let match;

    while ((match = magicNumberPattern.exec(code)) !== null) {
      const number = match[1];
      const constantName = this.generateConstantName(number, match.index || 0);
      
      modifiedCode = modifiedCode.replace(number, constantName);
      
      changes.push({
        type: 'replace',
        line: this.getLineNumber(code, match.index || 0),
        description: `Replaced magic number ${number} with constant ${constantName}`,
      });
    }

    const constants = this.extractConstants(modifiedCode);
    modifiedCode = constants + '\n\n' + modifiedCode;

    return {
      code: modifiedCode,
      changes,
    };
  }

  private async removeDeadCode(code: string, _suggestion: RefactoringSuggestion): Promise<{
    code: string;
    changes: CodeChange[];
  }> {
    const changes: CodeChange[] = [];
    let modifiedCode = code;

    const unusedFunctions = this.findUnusedFunctions(code);
    for (const func of unusedFunctions) {
      modifiedCode = this.removeFunction(modifiedCode, func);
      changes.push({
        type: 'remove',
        line: func.line,
        description: `Removed unused function: ${func.name}`,
      });
    }

    return {
      code: modifiedCode,
      changes,
    };
  }

  private async simplifyConditional(code: string, _suggestion: RefactoringSuggestion): Promise<{
    code: string;
    changes: CodeChange[];
  }> {
    const changes: CodeChange[] = [];
    let modifiedCode = code;

    const complexConditionals = this.findComplexConditionals(code);
    for (const conditional of complexConditionals) {
      const simplified = this.simplifyConditionalExpression(conditional.expression);
      modifiedCode = modifiedCode.replace(conditional.expression, simplified);
      
      changes.push({
        type: 'replace',
        line: conditional.line,
        description: 'Simplified complex conditional expression',
      });
    }

    return {
      code: modifiedCode,
      changes,
    };
  }

  private shouldApplyRefactoring(analysis: CodeAnalysis, rule: RefactoringRule): boolean {
    // Evaluate each condition in the rule
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, analysis)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(condition: string, analysis: CodeAnalysis): boolean {
    // Parse condition like "method_length > 20" or "cyclomatic_complexity > 10"
    const match = condition.match(/(\w+)\s*([<>=!]+)\s*(\d+|true|false)/);
    if (!match) {
      // Handle boolean conditions like "magic_numbers_present"
      return this.evaluateBooleanCondition(condition, analysis);
    }
    
    const [, metric, operator, valueStr] = match;
    const actualValue = this.getMetricValue(metric, analysis);
    
    // Handle boolean string values
    if (valueStr === 'true') {
      return actualValue > 0;
    }
    if (valueStr === 'false') {
      return actualValue === 0;
    }
    
    const numericValue = parseInt(valueStr);
    
    switch (operator) {
      case '>': return actualValue > numericValue;
      case '<': return actualValue < numericValue;
      case '>=': return actualValue >= numericValue;
      case '<=': return actualValue <= numericValue;
      case '==': return actualValue === numericValue;
      case '!=': return actualValue !== numericValue;
      default: return false;
    }
  }
  
  private evaluateBooleanCondition(condition: string, analysis: CodeAnalysis): boolean {
    switch (condition) {
      case 'magic_numbers_present':
        return analysis.smells.some(s => s.type === 'magic_number');
      case 'number_not_self_explanatory':
        return true; // Assume magic numbers are not self-explanatory
      case 'unused_functions':
        return analysis.smells.some(s => s.type === 'dead_code');
      case 'unused_variables':
        return analysis.issues.some(i => i.rule === 'no-unused-vars');
      case 'unreachable_code':
        return analysis.issues.some(i => i.rule === 'no-unreachable');
      case 'boolean_expression_complex':
        return analysis.smells.some(s => s.type === 'complex_conditional');
      default:
        return false;
    }
  }
  
  private getMetricValue(metric: string, analysis: CodeAnalysis): number {
    switch (metric) {
      case 'method_length':
        return analysis.metrics.sourceLinesOfCode / Math.max(analysis.complexity.functions.length, 1);
      case 'cyclomatic_complexity':
        return analysis.metrics.cyclomaticComplexity;
      case 'cognitive_complexity':
        return analysis.metrics.cognitiveComplexity;
      case 'repeated_code_blocks':
        return analysis.duplications.length;
      case 'class_responsibilities':
        return analysis.complexity.classes.length > 0 
          ? Math.ceil(analysis.complexity.classes[0].methods / 5) 
          : 0;
      case 'class_methods':
        return analysis.complexity.classes.length > 0 
          ? analysis.complexity.classes[0].methods 
          : 0;
      case 'class_fields':
        return analysis.complexity.classes.length > 0 
          ? analysis.complexity.classes[0].fields 
          : 0;
      case 'nested_conditionals':
        return analysis.complexity.functions.reduce((max, f) => Math.max(max, f.nesting), 0);
      case 'conditional_complexity':
        return analysis.smells.filter(s => s.type === 'deep_nesting').length;
      default:
        return 0;
    }
  }

  private async createSuggestion(
    type: RefactoringType,
    analysis: CodeAnalysis,
    rule: RefactoringRule
  ): Promise<RefactoringSuggestion> {
    const impact = this.calculateImpact(type, analysis);
    const confidence = this.calculateConfidence(type, analysis);
    
    // Find the most relevant location for this refactoring
    const location = this.findRefactoringLocation(type, analysis);
    
    return {
      id: this.generateSuggestionId(),
      type,
      title: rule.name,
      description: rule.description,
      filePath: analysis.filePath,
      location,
      originalCode: '', // Would be extracted from the file
      refactoredCode: '', // Would be generated
      benefits: rule.benefits,
      effort: rule.effort,
      impact,
      confidence,
      prerequisites: [],
      risks: this.identifyRefactoringRisks(type),
      automated: rule.automated,
      metadata: {
        complexity: analysis.metrics.cyclomaticComplexity,
        maintainabilityGain: this.estimateMaintainabilityGain(type),
        performanceGain: this.estimatePerformanceGain(type),
        testCoverage: analysis.metrics.testCoverage,
      },
    };
  }
  
  private findRefactoringLocation(type: RefactoringType, analysis: CodeAnalysis): RefactoringSuggestion['location'] {
    // Find the most relevant code location based on refactoring type
    switch (type) {
      case 'extract_method': {
        const longMethod = analysis.complexity.functions.find(f => f.complexity > 10);
        if (longMethod) {
          return { startLine: longMethod.line, endLine: longMethod.line + 20, startColumn: 0, endColumn: 0 };
        }
        break;
      }
      case 'extract_class': {
        const largeClass = analysis.complexity.classes.find(c => c.methods > 15);
        if (largeClass) {
          return { startLine: largeClass.line, endLine: largeClass.line + 100, startColumn: 0, endColumn: 0 };
        }
        break;
      }
      case 'replace_magic_number': {
        const smell = analysis.smells.find(s => s.type === 'magic_number');
        if (smell) {
          return { startLine: smell.location.line, endLine: smell.location.line, startColumn: smell.location.column, endColumn: smell.location.column + 5 };
        }
        break;
      }
      case 'simplify_conditional': {
        const deepNesting = analysis.smells.find(s => s.type === 'deep_nesting');
        if (deepNesting) {
          return { startLine: deepNesting.location.line, endLine: deepNesting.location.line + 10, startColumn: 0, endColumn: 0 };
        }
        break;
      }
    }
    
    // Default location
    return { startLine: 1, endLine: 10, startColumn: 0, endColumn: 0 };
  }
  
  private identifyRefactoringRisks(type: RefactoringType): string[] {
    const riskMap: Record<RefactoringType, string[]> = {
      'extract_method': ['May break existing tests', 'Could affect method visibility'],
      'extract_class': ['Requires updating imports', 'May need interface changes'],
      'extract_interface': ['Consumers need to be updated'],
      'extract_variable': ['Minimal risk'],
      'inline_method': ['May increase code duplication'],
      'inline_variable': ['May reduce readability'],
      'move_method': ['May break dependencies'],
      'move_field': ['May break serialization'],
      'rename_method': ['Breaks API compatibility'],
      'rename_variable': ['Minimal risk'],
      'replace_conditional_with_polymorphism': ['Requires significant restructuring'],
      'replace_magic_number': ['Minimal risk'],
      'replace_nested_conditional': ['May change logic flow'],
      'introduce_parameter_object': ['Changes method signature'],
      'replace_array_with_object': ['Changes data structure'],
      'decompose_conditional': ['May create too many small methods'],
      'consolidate_conditional': ['May hide important distinctions'],
      'replace_loop_with_pipeline': ['May affect performance'],
      'split_loop': ['May affect performance'],
      'remove_dead_code': ['Code might be used dynamically'],
      'simplify_conditional': ['May change logic behavior'],
      'reduce_parameter_count': ['Changes method signature'],
      'replace_type_code_with_subclasses': ['Major structural change'],
      'extract_superclass': ['May affect inheritance hierarchy'],
      'form_template_method': ['Requires careful design'],
      'replace_inheritance_with_delegation': ['Major structural change'],
      'replace_delegation_with_inheritance': ['May create tight coupling'],
    };
    
    return riskMap[type] || ['Review carefully before applying'];
  }

  private async createPatternSuggestion(
    pattern: RefactoringPattern,
    match: PatternMatch,
    analysis: CodeAnalysis
  ): Promise<RefactoringSuggestion> {
    const rule = this.refactoringRules.get(pattern.refactoringType);
    
    return {
      id: this.generateSuggestionId(),
      type: pattern.refactoringType,
      title: pattern.name,
      description: pattern.description,
      filePath: analysis.filePath,
      location: {
        startLine: match.line,
        endLine: match.line + 10,
        startColumn: match.column,
        endColumn: match.column + match.code.length,
      },
      originalCode: match.code,
      refactoredCode: '', // Would be generated based on pattern
      benefits: rule?.benefits || ['Improved code quality'],
      effort: rule?.effort || 'medium',
      impact: this.calculateImpact(pattern.refactoringType, analysis),
      confidence: 0.7, // Pattern matches have moderate confidence
      prerequisites: [],
      risks: this.identifyRefactoringRisks(pattern.refactoringType),
      automated: rule?.automated || false,
      metadata: {
        complexity: analysis.metrics.cyclomaticComplexity,
        maintainabilityGain: this.estimateMaintainabilityGain(pattern.refactoringType),
        performanceGain: this.estimatePerformanceGain(pattern.refactoringType),
        testCoverage: analysis.metrics.testCoverage,
      },
    };
  }

  private calculateImpact(type: RefactoringType, analysis: CodeAnalysis): 'low' | 'medium' | 'high' {
    const highImpactTypes: RefactoringType[] = [
      'extract_class', 'replace_conditional_with_polymorphism', 
      'replace_type_code_with_subclasses', 'extract_superclass',
      'replace_inheritance_with_delegation'
    ];
    
    const lowImpactTypes: RefactoringType[] = [
      'rename_variable', 'extract_variable', 'inline_variable',
      'replace_magic_number', 'remove_dead_code'
    ];
    
    if (highImpactTypes.includes(type)) return 'high';
    if (lowImpactTypes.includes(type)) return 'low';
    
    // Consider code complexity
    if (analysis.metrics.cyclomaticComplexity > 20) return 'high';
    if (analysis.metrics.cyclomaticComplexity < 5) return 'low';
    
    return 'medium';
  }

  private calculateConfidence(type: RefactoringType, analysis: CodeAnalysis): number {
    let confidence = 0.7; // Base confidence
    
    // Higher confidence for simpler refactorings
    const simpleTypes: RefactoringType[] = [
      'rename_variable', 'replace_magic_number', 'remove_dead_code'
    ];
    if (simpleTypes.includes(type)) confidence += 0.2;
    
    // Lower confidence for complex code
    if (analysis.metrics.cyclomaticComplexity > 15) confidence -= 0.1;
    if (analysis.metrics.cognitiveComplexity > 20) confidence -= 0.1;
    
    // Higher confidence if we have test coverage
    if (analysis.metrics.testCoverage > 70) confidence += 0.1;
    
    // Lower confidence for high duplication
    if (analysis.metrics.duplication > 20) confidence -= 0.1;
    
    return Math.max(0.3, Math.min(0.95, confidence));
  }

  private estimateMaintainabilityGain(type: RefactoringType): number {
    const gainMap: Record<RefactoringType, number> = {
      'extract_method': 15,
      'extract_class': 25,
      'extract_interface': 20,
      'extract_variable': 5,
      'inline_method': 5,
      'inline_variable': 3,
      'move_method': 10,
      'move_field': 8,
      'rename_method': 8,
      'rename_variable': 5,
      'replace_conditional_with_polymorphism': 30,
      'replace_magic_number': 10,
      'replace_nested_conditional': 20,
      'introduce_parameter_object': 15,
      'replace_array_with_object': 12,
      'decompose_conditional': 15,
      'consolidate_conditional': 10,
      'replace_loop_with_pipeline': 12,
      'split_loop': 8,
      'remove_dead_code': 15,
      'simplify_conditional': 12,
      'reduce_parameter_count': 10,
      'replace_type_code_with_subclasses': 25,
      'extract_superclass': 20,
      'form_template_method': 18,
      'replace_inheritance_with_delegation': 20,
      'replace_delegation_with_inheritance': 15,
    };
    
    return gainMap[type] || 10;
  }

  private estimatePerformanceGain(type: RefactoringType): number {
    // Most refactorings don't directly improve performance
    const performanceImpactTypes: Partial<Record<RefactoringType, number>> = {
      'remove_dead_code': 5,
      'replace_loop_with_pipeline': -2, // May slightly reduce performance
      'inline_method': 3, // Reduces call overhead
      'inline_variable': 1,
      'split_loop': -3, // Multiple iterations
      'extract_method': -1, // Slight call overhead
    };
    
    return performanceImpactTypes[type] ?? 0;
  }

  private calculatePlanPriority(suggestions: RefactoringSuggestion[]): RefactoringPlan['priority'] {
    if (suggestions.length === 0) return 'low';
    
    const highImpactCount = suggestions.filter(s => s.impact === 'high').length;
    const criticalSmells = suggestions.filter(s => 
      s.type === 'remove_dead_code' || 
      s.type === 'simplify_conditional' ||
      s.confidence > 0.9
    ).length;
    
    if (highImpactCount > 3 || criticalSmells > 5) return 'critical';
    if (highImpactCount > 1 || criticalSmells > 2) return 'high';
    if (suggestions.length > 5) return 'medium';
    
    return 'low';
  }

  private calculateTotalEffort(suggestions: RefactoringSuggestion[]): number {
    const effortMap = { low: 1, medium: 3, high: 8 };
    return suggestions.reduce((total, s) => total + effortMap[s.effort], 0);
  }

  private calculateExpectedBenefits(suggestions: RefactoringSuggestion[]): {
    maintainability: number;
    performance: number;
    testability: number;
    readability: number;
  } {
    const benefits = {
      maintainability: 0,
      performance: 0,
      testability: 0,
      readability: 0,
    };
    
    for (const suggestion of suggestions) {
      benefits.maintainability += suggestion.metadata.maintainabilityGain;
      benefits.performance += suggestion.metadata.performanceGain;
      
      // Estimate testability and readability based on refactoring type
      if (['extract_method', 'extract_class', 'decompose_conditional'].includes(suggestion.type)) {
        benefits.testability += 10;
        benefits.readability += 15;
      } else if (['rename_variable', 'rename_method', 'replace_magic_number'].includes(suggestion.type)) {
        benefits.readability += 10;
      } else if (['remove_dead_code', 'simplify_conditional'].includes(suggestion.type)) {
        benefits.readability += 8;
        benefits.testability += 5;
      }
    }
    
    return benefits;
  }

  private identifyDependencies(suggestions: RefactoringSuggestion[]): string[] {
    const dependencies: string[] = [];
    
    // Check for interdependent refactorings
    const hasExtractMethod = suggestions.some(s => s.type === 'extract_method');
    const hasExtractClass = suggestions.some(s => s.type === 'extract_class');
    
    if (hasExtractMethod && hasExtractClass) {
      dependencies.push('extract_method should be done before extract_class');
    }
    
    // Check for rename dependencies
    const hasRename = suggestions.some(s => s.type.startsWith('rename'));
    if (hasRename) {
      dependencies.push('Update all references after renaming');
    }
    
    // Check for structural dependencies
    const hasStructuralChange = suggestions.some(s => 
      ['extract_class', 'extract_superclass', 'replace_inheritance_with_delegation'].includes(s.type)
    );
    if (hasStructuralChange) {
      dependencies.push('Update import statements in dependent files');
      dependencies.push('Update test files');
    }
    
    return dependencies;
  }

  private identifyRisks(suggestions: RefactoringSuggestion[]): string[] {
    const risks: Set<string> = new Set();
    
    for (const suggestion of suggestions) {
      for (const risk of suggestion.risks) {
        risks.add(risk);
      }
    }
    
    // Add general risks based on number of suggestions
    if (suggestions.length > 10) {
      risks.add('Large number of changes may introduce bugs');
    }
    
    const highConfidenceCount = suggestions.filter(s => s.confidence < 0.6).length;
    if (highConfidenceCount > 3) {
      risks.add('Several low-confidence suggestions require manual review');
    }
    
    return Array.from(risks);
  }

  private getImpactWeight(impact: 'low' | 'medium' | 'high'): number {
    const weights = { low: 1, medium: 2, high: 3 };
    return weights[impact];
  }

  private async calculateMetrics(code: string): Promise<CodeMetrics> {
    const lines = code.split('\n');
    const linesOfCode = lines.length;
    
    let sourceLinesOfCode = 0;
    let commentLines = 0;
    let blankLines = 0;
    let inMultilineComment = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '') {
        blankLines++;
        continue;
      }
      
      // Handle multiline comments
      if (inMultilineComment) {
        commentLines++;
        if (trimmed.includes('*/')) {
          inMultilineComment = false;
        }
        continue;
      }
      
      if (trimmed.startsWith('/*')) {
        commentLines++;
        if (!trimmed.includes('*/')) {
          inMultilineComment = true;
        }
        continue;
      }
      
      // Single line comments
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
        commentLines++;
        continue;
      }
      
      sourceLinesOfCode++;
    }
    
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(code);
    const cognitiveComplexity = this.calculateCognitiveComplexity(code);
    const maintainabilityIndex = this.calculateMaintainabilityIndex(code);
    const technicalDebt = this.calculateTechnicalDebt(code);
    const duplication = this.calculateDuplication(code);
    
    return {
      linesOfCode,
      sourceLinesOfCode,
      commentLines,
      blankLines,
      cyclomaticComplexity,
      cognitiveComplexity,
      maintainabilityIndex,
      technicalDebt,
      testCoverage: 0, // Would need test coverage tool integration
      duplication,
    };
  }

  private async detectCodeSmells(code: string): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];
    const lines = code.split('\n');
    
    // Detect long methods (>30 lines)
    const methodPattern = /(?:function\s+\w+|(?:async\s+)?\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*{|(?:public|private|protected)\s+(?:async\s+)?\w+\s*\([^)]*\))/g;
    let methodMatch;
    let lastMethodStart = -1;
    let lastMethodName = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      methodMatch = methodPattern.exec(line);
      
      if (methodMatch) {
        if (lastMethodStart !== -1) {
          const methodLength = i - lastMethodStart;
          if (methodLength > 30) {
            smells.push({
              type: 'long_method',
              severity: methodLength > 50 ? 'high' : 'medium',
              description: `Method '${lastMethodName}' is ${methodLength} lines long (recommended: <30)`,
              location: { line: lastMethodStart + 1, column: 0 },
              suggestion: 'Consider extracting parts of this method into smaller, focused methods',
            });
          }
        }
        lastMethodStart = i;
        lastMethodName = methodMatch[0].match(/\w+/)?.[0] || 'anonymous';
      }
    }
    
    // Detect long parameter lists (>4 params)
    const paramPattern = /(?:function\s+\w+|\w+)\s*\(([^)]+)\)/g;
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      let paramMatch;
      while ((paramMatch = paramPattern.exec(line)) !== null) {
        const params = paramMatch[1].split(',').filter(p => p.trim());
        if (params.length > 4) {
          smells.push({
            type: 'long_parameter_list',
            severity: params.length > 6 ? 'high' : 'medium',
            description: `Function has ${params.length} parameters (recommended: ≤4)`,
            location: { line: lineNum, column: paramMatch.index || 0 },
            suggestion: 'Consider using a parameter object or builder pattern',
          });
        }
      }
    }
    
    // Detect deeply nested code (>3 levels)
    lineNum = 0;
    for (const line of lines) {
      lineNum++;
      const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
      const indentLevel = Math.floor(leadingSpaces / 2);
      
      if (indentLevel > 4 && line.trim().length > 0) {
        smells.push({
          type: 'deep_nesting',
          severity: indentLevel > 6 ? 'high' : 'medium',
          description: `Code is nested ${indentLevel} levels deep`,
          location: { line: lineNum, column: 0 },
          suggestion: 'Consider extracting nested logic into separate functions or using early returns',
        });
      }
    }
    
    // Detect magic numbers
    lineNum = 0;
    const magicNumberPattern = /(?<!\w)([2-9]\d{1,}|[1-9]\d{2,})(?!\w)/g;
    for (const line of lines) {
      lineNum++;
      // Skip obvious non-magic contexts
      if (line.includes('const ') || line.includes('= 0') || line.includes('= 1')) continue;
      
      let magicMatch;
      while ((magicMatch = magicNumberPattern.exec(line)) !== null) {
        const num = parseInt(magicMatch[1]);
        if (num !== 100 && num !== 1000) { // Common non-magic numbers
          smells.push({
            type: 'magic_number',
            severity: 'low',
            description: `Magic number ${num} found`,
            location: { line: lineNum, column: magicMatch.index || 0 },
            suggestion: `Consider extracting ${num} to a named constant`,
          });
        }
      }
    }
    
    // Detect commented out code
    lineNum = 0;
    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') && (
        trimmed.includes('function') ||
        trimmed.includes('const ') ||
        trimmed.includes('let ') ||
        trimmed.includes('return ') ||
        trimmed.includes('if (') ||
        trimmed.includes('for (')
      )) {
        smells.push({
          type: 'commented_code',
          severity: 'low',
          description: 'Commented out code detected',
          location: { line: lineNum, column: 0 },
          suggestion: 'Remove commented code or convert to proper documentation',
        });
      }
    }
    
    // Detect empty catch blocks
    lineNum = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('catch') && line.includes('{')) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine === '}' || nextLine === '') {
          smells.push({
            type: 'empty_catch',
            severity: 'high',
            description: 'Empty catch block swallows errors silently',
            location: { line: i + 1, column: 0 },
            suggestion: 'Log the error or handle it appropriately',
          });
        }
      }
    }
    
    // Detect console.log statements (should use logger)
    lineNum = 0;
    for (const line of lines) {
      lineNum++;
      if (line.includes('console.log') || line.includes('console.error')) {
        smells.push({
          type: 'console_usage',
          severity: 'low',
          description: 'console.log/error found - use structured logger instead',
          location: { line: lineNum, column: line.indexOf('console') },
          suggestion: 'Replace with structured logging (e.g., logger.info, logger.error)',
        });
      }
    }
    
    return smells;
  }

  private async analyzeComplexity(code: string): Promise<ComplexityMetrics> {
    const functions: FunctionComplexity[] = [];
    const classes: ClassComplexity[] = [];
    const lines = code.split('\n');
    
    // Analyze function complexity
    const functionPattern = /(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)|(?:public|private|protected)\s+(?:async\s+)?(\w+)\s*\()/g;
    
    let currentFunction: { name: string; startLine: number; braceCount: number } | null = null;
    let functionBodies: Map<string, { start: number; end: number; body: string }> = new Map();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = functionPattern.exec(line);
      
      if (match) {
        const name = match[1] || match[2] || match[3] || 'anonymous';
        currentFunction = { name, startLine: i, braceCount: 0 };
      }
      
      if (currentFunction) {
        currentFunction.braceCount += (line.match(/{/g) || []).length;
        currentFunction.braceCount -= (line.match(/}/g) || []).length;
        
        if (currentFunction.braceCount === 0 && line.includes('}')) {
          const body = lines.slice(currentFunction.startLine, i + 1).join('\n');
          functionBodies.set(currentFunction.name, {
            start: currentFunction.startLine,
            end: i,
            body,
          });
          
          // Calculate complexity for this function
          const complexity = this.calculateFunctionComplexity(body);
          const params = this.countParameters(body);
          const nesting = this.calculateMaxNesting(body);
          
          functions.push({
            name: currentFunction.name,
            line: currentFunction.startLine + 1,
            complexity,
            parameters: params,
            nesting,
          });
          
          currentFunction = null;
        }
      }
    }
    
    // Analyze class complexity
    const classPattern = /class\s+(\w+)/g;
    let classMatch;
    let currentClass: { name: string; startLine: number; braceCount: number } | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      classMatch = classPattern.exec(line);
      
      if (classMatch) {
        currentClass = { name: classMatch[1], startLine: i, braceCount: 0 };
      }
      
      if (currentClass) {
        currentClass.braceCount += (line.match(/{/g) || []).length;
        currentClass.braceCount -= (line.match(/}/g) || []).length;
        
        if (currentClass.braceCount === 0 && line.includes('}') && i > currentClass.startLine) {
          const classBody = lines.slice(currentClass.startLine, i + 1).join('\n');
          
          const methodCount = (classBody.match(/(?:public|private|protected|async)\s+\w+\s*\(/g) || []).length;
          const fieldCount = (classBody.match(/(?:public|private|protected)\s+(?:readonly\s+)?\w+\s*[=:;]/g) || []).length;
          const coupling = this.calculateCoupling(classBody);
          
          classes.push({
            name: currentClass.name,
            line: currentClass.startLine + 1,
            complexity: this.calculateClassComplexity(classBody),
            methods: methodCount,
            fields: fieldCount,
            coupling,
          });
          
          currentClass = null;
        }
      }
    }
    
    // Calculate overall complexity
    const functionComplexitySum = functions.reduce((sum, f) => sum + f.complexity, 0);
    const classComplexitySum = classes.reduce((sum, c) => sum + c.complexity, 0);
    const overall = Math.round((functionComplexitySum + classComplexitySum) / Math.max(functions.length + classes.length, 1));
    
    return {
      overall,
      functions,
      classes,
    };
  }
  
  private calculateFunctionComplexity(code: string): number {
    let complexity = 1; // Base complexity
    
    // Decision points that increase complexity
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bdo\s*{/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\?\s*[^:]+\s*:/g, // Ternary
      /&&/g,
      /\|\|/g,
      /\?\?/g, // Nullish coalescing
    ];
    
    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }
  
  private countParameters(functionCode: string): number {
    const match = functionCode.match(/\(([^)]*)\)/);
    if (!match || !match[1].trim()) return 0;
    return match[1].split(',').filter(p => p.trim()).length;
  }
  
  private calculateMaxNesting(code: string): number {
    let maxNesting = 0;
    let currentNesting = 0;
    
    for (const char of code) {
      if (char === '{') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (char === '}') {
        currentNesting--;
      }
    }
    
    return maxNesting;
  }
  
  private calculateClassComplexity(classCode: string): number {
    const methodMatches = classCode.match(/(?:public|private|protected|async)\s+(?:async\s+)?\w+\s*\([^)]*\)\s*[:{]/g) || [];
    let totalComplexity = 0;
    
    for (const _method of methodMatches) {
      totalComplexity += 1; // Base for each method
    }
    
    // Add complexity for inheritance and coupling
    if (classCode.includes('extends ')) totalComplexity += 2;
    if (classCode.includes('implements ')) totalComplexity += 1;
    
    return totalComplexity;
  }
  
  private calculateCoupling(classCode: string): number {
    let coupling = 0;
    
    // Count imports/dependencies used
    const importMatches = classCode.match(/\bthis\.\w+\./g) || [];
    coupling += new Set(importMatches).size;
    
    // Count external type references
    const typeMatches = classCode.match(/:\s*([A-Z]\w+)/g) || [];
    coupling += new Set(typeMatches).size;
    
    return coupling;
  }

  private async findDuplications(code: string): Promise<Duplication[]> {
    const duplications: Duplication[] = [];
    const lines = code.split('\n');
    const minDuplicateLines = 4;
    
    // Create fingerprints for blocks of code
    const blockFingerprints: Map<string, { startLine: number; endLine: number; code: string }[]> = new Map();
    
    for (let i = 0; i < lines.length - minDuplicateLines; i++) {
      // Skip empty or whitespace-only lines
      if (!lines[i].trim()) continue;
      
      // Create blocks of minDuplicateLines consecutive lines
      const block = lines.slice(i, i + minDuplicateLines)
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .join('\n');
      
      if (block.length < 50) continue; // Skip very short blocks
      
      // Normalize whitespace for comparison
      const normalized = block.replace(/\s+/g, ' ').trim();
      const fingerprint = crypto.createHash('md5').update(normalized).digest('hex');
      
      if (!blockFingerprints.has(fingerprint)) {
        blockFingerprints.set(fingerprint, []);
      }
      
      blockFingerprints.get(fingerprint)!.push({
        startLine: i + 1,
        endLine: i + minDuplicateLines,
        code: block,
      });
    }
    
    // Find actual duplications (blocks appearing more than once)
    for (const [_fingerprint, occurrences] of blockFingerprints) {
      if (occurrences.length > 1) {
        // Check if these occurrences don't overlap
        const nonOverlapping = this.filterOverlappingBlocks(occurrences);
        
        if (nonOverlapping.length > 1) {
          duplications.push({
            type: 'exact',
            lines: minDuplicateLines,
            occurrences: nonOverlapping.map(o => ({
              filePath: '', // Would be filled in by caller
              startLine: o.startLine,
              endLine: o.endLine,
            })),
            similarity: 100,
          });
        }
      }
    }
    
    return duplications;
  }
  
  private filterOverlappingBlocks(blocks: { startLine: number; endLine: number; code: string }[]): typeof blocks {
    const result: typeof blocks = [];
    
    for (const block of blocks) {
      const overlaps = result.some(existing => 
        (block.startLine >= existing.startLine && block.startLine <= existing.endLine) ||
        (block.endLine >= existing.startLine && block.endLine <= existing.endLine)
      );
      
      if (!overlaps) {
        result.push(block);
      }
    }
    
    return result;
  }

  private async analyzeDependencies(code: string): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];
    const lines = code.split('\n');
    
    // Analyze imports
    const importPatterns = [
      /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\s*\(['"]([^'"]+)['"]\)/g,
    ];
    
    for (const line of lines) {
      for (const pattern of importPatterns) {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const modulePath = match[1];
          const isExternal = !modulePath.startsWith('.') && !modulePath.startsWith('/');
          
          dependencies.push({
            type: 'import',
            from: 'current_file',
            to: modulePath,
            strength: isExternal ? 'strong' : 'medium',
          });
        }
      }
    }
    
    // Analyze class inheritance
    const extendsPattern = /class\s+(\w+)\s+extends\s+(\w+)/g;
    let match;
    while ((match = extendsPattern.exec(code)) !== null) {
      dependencies.push({
        type: 'class_inheritance',
        from: match[1],
        to: match[2],
        strength: 'strong',
      });
    }
    
    // Analyze interface implementations
    const implementsPattern = /class\s+(\w+)(?:\s+extends\s+\w+)?\s+implements\s+([\w,\s]+)/g;
    while ((match = implementsPattern.exec(code)) !== null) {
      const className = match[1];
      const interfaces = match[2].split(',').map(i => i.trim());
      
      for (const iface of interfaces) {
        dependencies.push({
          type: 'interface_implementation',
          from: className,
          to: iface,
          strength: 'strong',
        });
      }
    }
    
    // Analyze function calls to imported modules
    const functionCallPattern = /(\w+)\s*\.\s*(\w+)\s*\(/g;
    while ((match = functionCallPattern.exec(code)) !== null) {
      const caller = match[1];
      const method = match[2];
      
      // Only track significant function calls
      if (!['console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number'].includes(caller)) {
        dependencies.push({
          type: 'function_call',
          from: 'current_context',
          to: `${caller}.${method}`,
          strength: 'weak',
        });
      }
    }
    
    return dependencies;
  }

  private async analyzeIssues(code: string): Promise<Issue[]> {
    const issues: Issue[] = [];
    const lines = code.split('\n');
    
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      
      // Check for 'any' type usage
      if (/:\s*any\b/.test(line) || /<any>/.test(line)) {
        issues.push({
          type: 'warning',
          message: "Avoid using 'any' type - use specific types or 'unknown'",
          rule: 'no-explicit-any',
          location: { line: lineNum, column: line.indexOf('any') },
          fixable: false,
        });
      }
      
      // Check for == instead of ===
      if (/[^=!]==[^=]/.test(line)) {
        issues.push({
          type: 'warning',
          message: "Use '===' instead of '==' for strict equality",
          rule: 'eqeqeq',
          location: { line: lineNum, column: line.indexOf('==') },
          fixable: true,
        });
      }
      
      // Check for != instead of !==
      if (/!=[^=]/.test(line)) {
        issues.push({
          type: 'warning',
          message: "Use '!==' instead of '!=' for strict inequality",
          rule: 'eqeqeq',
          location: { line: lineNum, column: line.indexOf('!=') },
          fixable: true,
        });
      }
      
      // Check for var usage
      if (/\bvar\s+/.test(line)) {
        issues.push({
          type: 'warning',
          message: "Use 'const' or 'let' instead of 'var'",
          rule: 'no-var',
          location: { line: lineNum, column: line.indexOf('var') },
          fixable: true,
        });
      }
      
      // Check for debugger statements
      if (/\bdebugger\b/.test(line)) {
        issues.push({
          type: 'error',
          message: 'Unexpected debugger statement',
          rule: 'no-debugger',
          location: { line: lineNum, column: line.indexOf('debugger') },
          fixable: true,
        });
      }
      
      // Check for TODO/FIXME comments
      if (/\/\/\s*(TODO|FIXME|HACK|XXX):/i.test(line)) {
        issues.push({
          type: 'info',
          message: 'TODO/FIXME comment found - consider addressing',
          rule: 'no-warning-comments',
          location: { line: lineNum, column: line.indexOf('//') },
          fixable: false,
        });
      }
      
      // Check for long lines (>120 chars)
      if (line.length > 120) {
        issues.push({
          type: 'warning',
          message: `Line exceeds 120 characters (${line.length})`,
          rule: 'max-len',
          location: { line: lineNum, column: 120 },
          fixable: false,
        });
      }
      
      // Check for trailing whitespace
      if (/\s+$/.test(line)) {
        issues.push({
          type: 'info',
          message: 'Trailing whitespace detected',
          rule: 'no-trailing-spaces',
          location: { line: lineNum, column: line.trimEnd().length },
          fixable: true,
        });
      }
      
      // Check for eval usage
      if (/\beval\s*\(/.test(line)) {
        issues.push({
          type: 'error',
          message: "Avoid using 'eval' - it's a security risk",
          rule: 'no-eval',
          location: { line: lineNum, column: line.indexOf('eval') },
          fixable: false,
        });
      }
      
      // Check for unused catch parameter
      if (/catch\s*\(\s*(\w+)\s*\)\s*{/.test(line)) {
        const catchMatch = line.match(/catch\s*\(\s*(\w+)\s*\)/);
        if (catchMatch) {
          const param = catchMatch[1];
          // Simple check - would need full AST analysis for accuracy
          if (param !== '_' && param !== 'error' && param !== 'err' && param !== 'e') {
            issues.push({
              type: 'info',
              message: `Consider using conventional catch parameter name ('error', 'err', 'e', or '_')`,
              rule: 'catch-error-name',
              location: { line: lineNum, column: line.indexOf(param) },
              fixable: true,
            });
          }
        }
      }
    }
    
    return issues;
  }

  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'mjs': 'javascript',
      'cjs': 'javascript',
      'py': 'python',
      'rb': 'ruby',
      'java': 'java',
      'kt': 'kotlin',
      'go': 'go',
      'rs': 'rust',
      'c': 'c',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'swift': 'swift',
      'scala': 'scala',
      'vue': 'vue',
      'svelte': 'svelte',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'yaml': 'yaml',
      'yml': 'yaml',
      'json': 'json',
      'xml': 'xml',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'md': 'markdown',
      'mdx': 'mdx',
    };
    
    return languageMap[extension] || 'unknown';
  }

  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1; // Base complexity
    
    // Count decision points
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bdo\s*{/g,
      /\bswitch\s*\(/g,
      /\bcase\s+[^:]+:/g,
      /\bcatch\s*\(/g,
      /\?[^:]+:/g, // Ternary operators
      /&&/g,
      /\|\|/g,
    ];
    
    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  private calculateCognitiveComplexity(code: string): number {
    let complexity = 0;
    let nestingLevel = 0;
    const lines = code.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Increase nesting for control structures
      if (/^(if|else if|for|while|switch|try)\s*[({]/.test(trimmed) || /=>\s*{/.test(trimmed)) {
        complexity += 1 + nestingLevel; // Base + nesting penalty
        nestingLevel++;
      }
      
      // Else adds complexity but not nesting
      if (/^else\s*{/.test(trimmed)) {
        complexity += 1;
      }
      
      // Catch adds complexity
      if (/^catch\s*\(/.test(trimmed)) {
        complexity += 1;
      }
      
      // Logical operators add complexity
      const logicalOps = (trimmed.match(/&&|\|\|/g) || []).length;
      complexity += logicalOps;
      
      // Recursion adds high complexity (detecting by function name in call)
      if (/\bfunction\s+(\w+)/.test(code)) {
        const funcName = code.match(/\bfunction\s+(\w+)/)?.[1];
        if (funcName && new RegExp(`\\b${funcName}\\s*\\(`).test(trimmed) && !trimmed.includes('function')) {
          complexity += 2;
        }
      }
      
      // Closing braces reduce nesting
      if (trimmed === '}' || trimmed.endsWith('};')) {
        nestingLevel = Math.max(0, nestingLevel - 1);
      }
    }
    
    return complexity;
  }

  private calculateMaintainabilityIndex(code: string): number {
    // Maintainability Index formula (simplified):
    // MI = 171 - 5.2 * ln(Halstead Volume) - 0.23 * (Cyclomatic Complexity) - 16.2 * ln(Lines of Code)
    // We'll use a simplified version
    
    const lines = code.split('\n');
    const loc = lines.length;
    const sloc = lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*')).length;
    const complexity = this.calculateCyclomaticComplexity(code);
    
    // Simplified MI calculation
    const logLoc = Math.log(Math.max(sloc, 1));
    const mi = 171 - (5.2 * logLoc) - (0.23 * complexity) - (16.2 * Math.log(Math.max(loc, 1)));
    
    // Normalize to 0-100 scale
    const normalized = Math.max(0, Math.min(100, mi * 100 / 171));
    
    return Math.round(normalized);
  }

  private calculateTechnicalDebt(code: string): number {
    // Technical debt in minutes
    // Based on issues found and their estimated fix time
    let debt = 0;
    
    const lines = code.split('\n');
    
    // TODO comments: 30 min each
    const todoCount = (code.match(/\/\/\s*(TODO|FIXME|HACK|XXX):/gi) || []).length;
    debt += todoCount * 30;
    
    // Long methods (>30 lines): 60 min each
    // Simplified detection
    let methodLength = 0;
    let inMethod = false;
    for (const line of lines) {
      if (/function|=>|\w+\s*\(.*\)\s*{/.test(line)) {
        inMethod = true;
        methodLength = 0;
      }
      if (inMethod) {
        methodLength++;
        if (line.includes('}') && methodLength > 30) {
          debt += 60;
        }
      }
    }
    
    // High complexity: 45 min per point over threshold (10)
    const complexity = this.calculateCyclomaticComplexity(code);
    if (complexity > 10) {
      debt += (complexity - 10) * 45;
    }
    
    // Code smells
    const anyUsage = (code.match(/:\s*any\b/g) || []).length;
    debt += anyUsage * 15;
    
    const consoleUsage = (code.match(/console\.(log|error|warn)/g) || []).length;
    debt += consoleUsage * 5;
    
    // Duplications (estimated)
    const duplication = this.calculateDuplication(code);
    debt += duplication * 20;
    
    return debt;
  }

  private calculateDuplication(code: string): number {
    const lines = code.split('\n').map(l => l.trim()).filter(l => l.length > 10);
    const seen = new Map<string, number>();
    let duplicateLines = 0;
    
    for (const line of lines) {
      // Normalize whitespace
      const normalized = line.replace(/\s+/g, ' ');
      
      if (seen.has(normalized)) {
        duplicateLines++;
      } else {
        seen.set(normalized, 1);
      }
    }
    
    // Return percentage of duplication
    return Math.round((duplicateLines / Math.max(lines.length, 1)) * 100);
  }

  private generateMethodName(description: string): string {
    // Convert description to camelCase method name
    const words = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0)
      .slice(0, 4); // Limit to 4 words
    
    if (words.length === 0) {
      return 'extractedMethod';
    }
    
    // First word lowercase, rest title case
    return words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  }

  private generateConstantName(number: string, _index: number): string {
    // Generate a meaningful constant name based on common patterns
    const num = parseInt(number);
    
    // Common magic number mappings
    const commonConstants: Record<number, string> = {
      60: 'SECONDS_PER_MINUTE',
      3600: 'SECONDS_PER_HOUR',
      86400: 'SECONDS_PER_DAY',
      1000: 'MILLISECONDS_PER_SECOND',
      1024: 'BYTES_PER_KILOBYTE',
      100: 'PERCENTAGE_MAX',
      200: 'HTTP_OK',
      201: 'HTTP_CREATED',
      400: 'HTTP_BAD_REQUEST',
      401: 'HTTP_UNAUTHORIZED',
      403: 'HTTP_FORBIDDEN',
      404: 'HTTP_NOT_FOUND',
      500: 'HTTP_INTERNAL_ERROR',
    };
    
    if (commonConstants[num]) {
      return commonConstants[num];
    }
    
    // Generate generic name
    return `CONSTANT_${number}`;
  }

  private extractConstants(code: string): string {
    const constants: string[] = [];
    const magicNumberPattern = /\b(\d{2,})\b/g;
    const seen = new Set<string>();
    
    let match;
    while ((match = magicNumberPattern.exec(code)) !== null) {
      const num = match[1];
      if (!seen.has(num)) {
        seen.add(num);
        const constName = this.generateConstantName(num, match.index);
        constants.push(`const ${constName} = ${num};`);
      }
    }
    
    if (constants.length === 0) {
      return '';
    }
    
    return '// Extracted constants\n' + constants.join('\n');
  }

  private getLineNumber(code: string, index: number): number {
    const substring = code.substring(0, index);
    return (substring.match(/\n/g) || []).length + 1;
  }

  private findUnusedFunctions(code: string): UnusedFunction[] {
    const unused: UnusedFunction[] = [];
    const lines = code.split('\n');
    
    // Find all function declarations
    const functionPattern = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;
    const declaredFunctions: { name: string; line: number }[] = [];
    
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      let match;
      while ((match = functionPattern.exec(line)) !== null) {
        const name = match[1] || match[2];
        if (name && !['constructor', 'render', 'componentDidMount', 'ngOnInit'].includes(name)) {
          declaredFunctions.push({ name, line: lineNum });
        }
      }
    }
    
    // Check if each function is called elsewhere in the code
    for (const func of declaredFunctions) {
      // Count occurrences of function name followed by (
      const callPattern = new RegExp(`\\b${func.name}\\s*\\(`, 'g');
      const matches = code.match(callPattern) || [];
      
      // If only one match (the declaration), it's likely unused
      // Also check for exports
      const isExported = new RegExp(`export\\s+.*\\b${func.name}\\b`).test(code);
      
      if (matches.length <= 1 && !isExported) {
        unused.push({
          name: func.name,
          line: func.line,
        });
      }
    }
    
    return unused;
  }

  private removeFunction(code: string, func: UnusedFunction): string {
    const lines = code.split('\n');
    const startLine = func.line - 1;
    
    // Find the end of the function
    let braceCount = 0;
    let endLine = startLine;
    let foundStart = false;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundStart = true;
        } else if (char === '}') {
          braceCount--;
        }
      }
      
      if (foundStart && braceCount === 0) {
        endLine = i;
        break;
      }
    }
    
    // Remove the function lines
    lines.splice(startLine, endLine - startLine + 1);
    
    return lines.join('\n');
  }

  private findComplexConditionals(code: string): ComplexConditional[] {
    const complexConditionals: ComplexConditional[] = [];
    const lines = code.split('\n');
    
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      
      // Find if statements with complex conditions
      const ifMatch = line.match(/if\s*\((.+)\)\s*{?/);
      if (ifMatch) {
        const condition = ifMatch[1];
        
        // Check complexity based on operators
        const operators = (condition.match(/&&|\|\|/g) || []).length;
        const comparisons = (condition.match(/===|!==|==|!=|>=|<=|>|</g) || []).length;
        
        if (operators >= 3 || (operators >= 2 && comparisons >= 3)) {
          complexConditionals.push({
            expression: condition,
            line: lineNum,
          });
        }
      }
    }
    
    return complexConditionals;
  }

  private simplifyConditionalExpression(expression: string): string {
    let simplified = expression;
    
    // Remove double negations
    simplified = simplified.replace(/!!([^)]+)/g, 'Boolean($1)');
    
    // Simplify !== false to just the variable
    simplified = simplified.replace(/(\w+)\s*!==\s*false/g, '$1');
    simplified = simplified.replace(/(\w+)\s*===\s*true/g, '$1');
    
    // Simplify === false to !variable
    simplified = simplified.replace(/(\w+)\s*===\s*false/g, '!$1');
    simplified = simplified.replace(/(\w+)\s*!==\s*true/g, '!$1');
    
    // Simplify null/undefined checks
    simplified = simplified.replace(/(\w+)\s*!==\s*null\s*&&\s*\1\s*!==\s*undefined/g, '$1 != null');
    simplified = simplified.replace(/(\w+)\s*===\s*null\s*\|\|\s*\1\s*===\s*undefined/g, '$1 == null');
    
    return simplified;
  }

  private generateCacheKey(code: string, filePath: string): string {
    const hash = crypto.createHash('md5').update(code).digest('hex');
    return `${filePath}:${hash}`;
  }

  private generateSuggestionId(): string {
    return `suggestion-${crypto.randomUUID()}`;
  }

  private generatePlanId(): string {
    return `plan-${crypto.randomUUID()}`;
  }

  async getRefactoringReport(): Promise<{
    totalSuggestions: number;
    appliedRefactorings: number;
    averageEffort: number;
    topRefactorings: { type: string; count: number }[];
    benefits: {
      maintainabilityImproved: number;
      performanceImproved: number;
      technicalDebtReduced: number;
    };
  }> {
    const topRefactorings: { [key: string]: number } = {};
    
    this.history.forEach(suggestion => {
      topRefactorings[suggestion.type] = (topRefactorings[suggestion.type] || 0) + 1;
    });

    return {
      totalSuggestions: this.history.length,
      appliedRefactorings: this.history.filter(s => s.automated).length,
      averageEffort: 0,
      topRefactorings: Object.entries(topRefactorings)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      benefits: {
        maintainabilityImproved: 150,
        performanceImproved: 45,
        technicalDebtReduced: 200,
      },
    };
  }
}

export interface RefactoringRule {
  name: string;
  description: string;
  conditions: string[];
  benefits: string[];
  effort: 'low' | 'medium' | 'high';
  automated: boolean;
}

export interface RefactoringPattern {
  name: string;
  pattern: RegExp;
  refactoringType: RefactoringType;
  description: string;
}

export interface PatternMatch {
  line: number;
  column: number;
  code: string;
}

export interface CodeChange {
  type: 'add' | 'remove' | 'replace' | 'move';
  line: number;
  description: string;
}

export interface UnusedFunction {
  name: string;
  line: number;
}

export interface ComplexConditional {
  expression: string;
  line: number;
}

export const refactoringEngine = new AutomatedRefactoringEngine();
