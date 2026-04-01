import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';

export interface CodeGenerationRequest {
  id: string;
  prompt: string;
  context: CodeContext;
  requirements: GenerationRequirements;
  preferences: CodePreferences;
  timestamp: Date;
  userId?: string;
  projectId?: string;
}

export interface CodeContext {
  language: string;
  framework?: string;
  existingCode?: string;
  imports?: string[];
  dependencies?: string[];
  architecture?: 'mvc' | 'component' | 'service' | 'microservice' | 'serverless';
  patterns?: string[];
  styleGuide?: string;
}

export interface GenerationRequirements {
  type: 'function' | 'class' | 'component' | 'module' | 'test' | 'api' | 'config' | 'migration';
  functionality: string;
  features: string[];
  constraints?: string[];
  performance?: PerformanceRequirements;
  security?: SecurityRequirements;
  testing?: TestingRequirements;
}

export interface PerformanceRequirements {
  maxResponseTime?: number;
  throughput?: number;
  memoryLimit?: number;
  concurrency?: number;
}

export interface SecurityRequirements {
  authentication?: boolean;
  authorization?: boolean;
  encryption?: boolean;
  validation?: boolean;
  sanitization?: boolean;
}

export interface TestingRequirements {
  unitTests?: boolean;
  integrationTests?: boolean;
  e2eTests?: boolean;
  coverage?: number;
}

export interface CodePreferences {
  style: 'functional' | 'object-oriented' | 'procedural';
  patterns: string[];
  libraries: string[];
  avoidLibraries?: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  documentation: boolean;
  errorHandling: 'basic' | 'comprehensive' | 'defensive';
  logging: boolean;
}

export interface GeneratedCode {
  id: string;
  requestId: string;
  code: string;
  language: string;
  files: GeneratedFile[];
  dependencies: Dependency[];
  explanation: string;
  usage: string;
  tests?: string;
  documentation?: string;
  metadata: {
    tokens: number;
    confidence: number;
    model: string;
    version: string;
    generationTime: number;
  };
  quality: CodeQuality;
  suggestions: CodeSuggestion[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'source' | 'test' | 'config' | 'documentation' | 'asset';
  language: string;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'runtime' | 'development' | 'peer' | 'optional';
  reason: string;
}

export interface CodeQuality {
  score: number;
  metrics: {
    complexity: number;
    maintainability: number;
    readability: number;
    testability: number;
    security: number;
    performance: number;
  };
  issues: QualityIssue[];
}

export interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  category: 'syntax' | 'style' | 'security' | 'performance' | 'best-practice';
  message: string;
  line?: number;
  column?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion?: string;
}

export interface CodeSuggestion {
  type: 'improvement' | 'alternative' | 'optimization' | 'refactor';
  description: string;
  code: string;
  reason: string;
  impact: 'low' | 'medium' | 'high';
}

export interface AIModel {
  name: string;
  provider: string;
  version: string;
  capabilities: string[];
  maxTokens: number;
  costPerToken: number;
}

export class AICodeGenerator extends EventEmitter {
  private models: Map<string, AIModel> = new Map();
  private generationHistory: CodeGenerationRequest[] = [];
  private codeCache: Map<string, GeneratedCode> = new Map();
  private templates: Map<string, CodeTemplate> = new Map();
  private activeGenerations: Map<string, Promise<GeneratedCode>> = new Map();

  constructor() {
    super();
    this.initializeModels();
    this.initializeTemplates();
  }

  private initializeModels(): void {
    this.models.set('gpt-4', {
      name: 'GPT-4',
      provider: 'OpenAI',
      version: '1.0',
      capabilities: ['code-generation', 'code-review', 'refactoring', 'documentation'],
      maxTokens: 8192,
      costPerToken: 0.00003,
    });

    this.models.set('codex', {
      name: 'Codex',
      provider: 'OpenAI',
      version: '1.0',
      capabilities: ['code-generation', 'code-completion', 'translation'],
      maxTokens: 4096,
      costPerToken: 0.00002,
    });

    this.models.set('claude', {
      name: 'Claude',
      provider: 'Anthropic',
      version: '2.1',
      capabilities: ['code-generation', 'analysis', 'documentation', 'debugging'],
      maxTokens: 100000,
      costPerToken: 0.00001,
    });
  }

  private initializeTemplates(): void {
    this.templates.set('react-component', {
      name: 'React Component',
      language: 'typescript',
      template: `import React from 'react';

interface {{ComponentName}}Props {
  {{props}}
}

export const {{ComponentName}}: React.FC<{{ComponentName}}Props> = ({{propsDestructured}}) => {
  return (
    <div className="{{className}}">
      {{content}}
    </div>
  );
};

export default {{ComponentName}};`,
    });

    this.templates.set('api-endpoint', {
      name: 'API Endpoint',
      language: 'typescript',
      template: `import { Request, Response } from 'express';

export const {{methodName}} = async (req: Request, res: Response) => {
  try {
    {{validation}}
    
    {{businessLogic}}
    
    res.status(200).json({
      success: true,
      data: {{responseData}},
    });
  } catch (error) {
    console.error('Error in {{methodName}}:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};`,
    });

    this.templates.set('test-suite', {
      name: 'Test Suite',
      language: 'typescript',
      template: `import { {{componentName}} } from '../{{componentPath}}';

describe('{{componentName}}', () => {
  {{testCases}}
});`,
    });
  }

  async generateCode(request: CodeGenerationRequest): Promise<GeneratedCode> {
    const requestId = request.id || this.generateRequestId();
    
    if (this.activeGenerations.has(requestId)) {
      return this.activeGenerations.get(requestId)!;
    }

    const generationPromise = this.performGeneration(request);
    this.activeGenerations.set(requestId, generationPromise);

    try {
      const result = await generationPromise;
      this.generationHistory.push(request);
      this.codeCache.set(requestId, result);
      this.emit('code-generated', { requestId, result });
      return result;
    } finally {
      this.activeGenerations.delete(requestId);
    }
  }

  private async performGeneration(request: CodeGenerationRequest): Promise<GeneratedCode> {
    const startTime = Date.now();
    
    const model = this.selectModel(request);
    const prompt = this.buildPrompt(request);
    
    let generatedCode: string;
    
    if (this.shouldUseTemplate(request)) {
      generatedCode = this.generateFromTemplate(request);
    } else {
      generatedCode = await this.callAIModel(model, prompt);
    }

    const files = this.parseGeneratedFiles(generatedCode, request);
    const dependencies = this.extractDependencies(generatedCode, request.context.language);
    const quality = await this.analyzeCodeQuality(generatedCode, request.context.language);
    const suggestions = await this.generateSuggestions(generatedCode, request);

    const result: GeneratedCode = {
      id: this.generateCodeId(),
      requestId: request.id,
      code: generatedCode,
      language: request.context.language,
      files,
      dependencies,
      explanation: await this.generateExplanation(generatedCode, request),
      usage: await this.generateUsageExample(generatedCode, request),
      tests: request.requirements.testing?.unitTests ? 
        await this.generateTests(generatedCode, request) : undefined,
      documentation: request.preferences.documentation ? 
        await this.generateDocumentation(generatedCode, request) : undefined,
      metadata: {
        tokens: this.estimateTokens(generatedCode),
        confidence: this.calculateConfidence(generatedCode, request),
        model: model.name,
        version: model.version,
        generationTime: Date.now() - startTime,
      },
      quality,
      suggestions,
    };

    return result;
  }

  private selectModel(request: CodeGenerationRequest): AIModel {
    const availableModels = Array.from(this.models.values());
    
    if (request.context.language === 'typescript' || request.context.language === 'javascript') {
      const model = this.models.get('gpt-4');
    if (!model) {
      throw new Error('GPT-4 model not available');
    }
    return model;
    }
    
    if (request.requirements.type === 'component') {
      const model = this.models.get('codex');
    if (!model) {
      throw new Error('Codex model not available');
    }
    return model;
    }
    
    const model = this.models.get('claude');
    if (!model) {
      throw new Error('Claude model not available');
    }
    return model;
  }

  private buildPrompt(request: CodeGenerationRequest): string {
    let prompt = `Generate ${request.requirements.type} in ${request.context.language}`;
    
    if (request.context.framework) {
      prompt += ` using ${request.context.framework}`;
    }
    
    prompt += `.\n\nRequirements:\n${request.requirements.functionality}\n\n`;
    
    if (request.requirements.features.length > 0) {
      prompt += `Features:\n${request.requirements.features.join('\n')}\n\n`;
    }
    
    if (request.context.existingCode) {
      prompt += `Existing code context:\n\`\`\`${request.context.language}\n${request.context.existingCode}\n\`\`\`\n\n`;
    }
    
    prompt += `Style preferences:\n`;
    prompt += `- Style: ${request.preferences.style}\n`;
    prompt += `- Complexity: ${request.preferences.complexity}\n`;
    prompt += `- Error handling: ${request.preferences.errorHandling}\n`;
    prompt += `- Documentation: ${request.preferences.documentation ? 'Yes' : 'No'}\n`;
    
    if (request.preferences.patterns.length > 0) {
      prompt += `- Patterns: ${request.preferences.patterns.join(', ')}\n`;
    }
    
    if (request.requirements.security) {
      prompt += `\nSecurity requirements:\n`;
      if (request.requirements.security.authentication) prompt += `- Authentication required\n`;
      if (request.requirements.security.authorization) prompt += `- Authorization required\n`;
      if (request.requirements.security.encryption) prompt += `- Encryption required\n`;
      if (request.requirements.security.validation) prompt += `- Input validation required\n`;
      if (request.requirements.security.sanitization) prompt += `- Input sanitization required\n`;
    }
    
    if (request.requirements.testing) {
      prompt += `\nTesting requirements:\n`;
      prompt += `- Unit tests: ${request.requirements.testing.unitTests ? 'Yes' : 'No'}\n`;
      prompt += `- Integration tests: ${request.requirements.testing.integrationTests ? 'Yes' : 'No'}\n`;
      if (request.requirements.testing.coverage) {
        prompt += `- Coverage target: ${request.requirements.testing.coverage}%\n`;
      }
    }
    
    prompt += `\nGenerate complete, production-ready code with proper error handling, logging, and documentation.`;
    
    return prompt;
  }

  private shouldUseTemplate(request: CodeGenerationRequest): boolean {
    const templateKey = this.getTemplateKey(request);
    return this.templates.has(templateKey);
  }

  private getTemplateKey(request: CodeGenerationRequest): string {
    if (request.context.framework === 'react' && request.requirements.type === 'component') {
      return 'react-component';
    }
    if (request.requirements.type === 'api') {
      return 'api-endpoint';
    }
    if (request.requirements.type === 'test') {
      return 'test-suite';
    }
    return '';
  }

  private generateFromTemplate(request: CodeGenerationRequest): string {
    const templateKey = this.getTemplateKey(request);
    const template = this.templates.get(templateKey);
    
    if (!template) {
      throw new Error(`Template not found: ${templateKey}`);
    }
    
    let code = template.template;
    
    code = code.replace(/{{ComponentName}}/g, this.generateComponentName(request));
    code = code.replace(/{{methodName}}/g, this.generateMethodName(request));
    code = code.replace(/{{props}}/g, this.generateProps(request));
    code = code.replace(/{{propsDestructured}}/g, this.generatePropsDestructured(request));
    code = code.replace(/{{content}}/g, this.generateContent(request));
    code = code.replace(/{{className}}/g, this.generateClassName(request));
    code = code.replace(/{{validation}}/g, this.generateValidation(request));
    code = code.replace(/{{businessLogic}}/g, this.generateBusinessLogic(request));
    code = code.replace(/{{responseData}}/g, this.generateResponseData(request));
    code = code.replace(/{{componentName}}/g, this.generateComponentName(request));
    code = code.replace(/{{componentPath}}/g, this.generateComponentPath(request));
    code = code.replace(/{{testCases}}/g, this.generateTestCases(request));
    
    return code;
  }

  private generateComponentName(_request: CodeGenerationRequest): string {
    const words = _request.requirements.functionality.split(' ');
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  }

  private generateMethodName(_request: CodeGenerationRequest): string {
    return _request.requirements.functionality.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  private generateProps(_request: CodeGenerationRequest): string {
    if (_request.requirements.features.includes('props')) {
      return 'data: any;\n  onAction?: () => void;';
    }
    return '';
  }

  private generatePropsDestructured(_request: CodeGenerationRequest): string {
    const props = this.generateProps(_request);
    if (props) {
      return '{ data, onAction }';
    }
    return '';
  }

  private generateContent(_request: CodeGenerationRequest): string {
    return '{/* Generated content */}';
  }

  private generateClassName(_request: CodeGenerationRequest): string {
    return this.generateMethodName(_request);
  }

  private generateValidation(_request: CodeGenerationRequest): string {
    if (_request.requirements.security?.validation) {
      return 'const { error } = validateInput(req.body);\n  if (error) {\n    return res.status(400).json({ success: false, error: error.details });\n  }';
    }
    return '';
  }

  private generateBusinessLogic(_request: CodeGenerationRequest): string {
    return '// Business logic implementation';
  }

  private generateResponseData(_request: CodeGenerationRequest): string {
    return 'result';
  }

  private generateComponentPath(_request: CodeGenerationRequest): string {
    return `./${this.generateComponentName(_request)}`;
  }

  private generateTestCases(_request: CodeGenerationRequest): string {
    return `  it('should render correctly', () => {
    // Test implementation
  });`;
  }

  private async callAIModel(model: AIModel, prompt: string): Promise<string> {
    console.log(`Calling AI model: ${model.name}`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`// Generated code for: ${prompt.substring(0, 100)}...\n\n// This is a placeholder implementation\n// In production, this would call the actual AI model API\nexport function generatedFunction() {\n  return 'Generated code';\n}`);
      }, 1000);
    });
  }

  private parseGeneratedFiles(code: string, request: CodeGenerationRequest): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    
    files.push({
      path: this.generateFileName(request),
      content: code,
      type: 'source',
      language: request.context.language,
    });
    
    if (request.requirements.testing?.unitTests) {
      files.push({
        path: this.generateTestFileName(request),
        content: this.generateTestFile(code, request),
        type: 'test',
        language: request.context.language,
      });
    }
    
    return files;
  }

  private generateFileName(_request: CodeGenerationRequest): string {
    const name = this.generateMethodName(_request);
    const extension = this.getFileExtension(_request.context.language);
    return `${name}.${extension}`;
  }

  private generateTestFileName(_request: CodeGenerationRequest): string {
    const name = this.generateMethodName(_request);
    const extension = this.getFileExtension(_request.context.language);
    return `${name}.test.${extension}`;
  }

  private getFileExtension(language: string): string {
    const extensions: { [key: string]: string } = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      java: 'java',
      go: 'go',
      php: 'php',
      ruby: 'rb',
      csharp: 'cs',
    };
    return extensions[language] || 'txt';
  }

  private generateTestFile(_code: string, _request: CodeGenerationRequest): string {
    return `// Test file for generated code\nimport { describe, it, expect } from '@jest/globals';\n\ndescribe('Generated code', () => {\n  it('should work correctly', () => {\n    expect(true).toBe(true);\n  });\n});`;
  }

  private extractDependencies(_code: string, language: string): Dependency[] {
    const dependencies: Dependency[] = [];
    
    if (language === 'typescript' || language === 'javascript') {
      const importRegex = /import.*from ['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(_code)) !== null) {
        const dep = match[1];
        if (dep && !dep.startsWith('.') && !dep.startsWith('/')) {
          dependencies.push({
            name: dep!,
            version: 'latest',
            type: 'runtime',
            reason: 'Imported in generated code',
          });
        }
      }
    }
    
    return dependencies;
  }

  private async analyzeCodeQuality(_code: string, language: string): Promise<CodeQuality> {
    const score = Math.random() * 40 + 60;
    
    return {
      score,
      metrics: {
        complexity: Math.random() * 30 + 20,
        maintainability: Math.random() * 30 + 60,
        readability: Math.random() * 20 + 70,
        testability: Math.random() * 30 + 50,
        security: Math.random() * 25 + 65,
        performance: Math.random() * 35 + 55,
      },
      issues: [],
    };
  }

  private async generateSuggestions(_code: string, _request: CodeGenerationRequest): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];
    
    if (_request.preferences.complexity === 'simple' && _code.length > 500) {
      suggestions.push({
        type: 'refactor',
        description: 'Consider breaking down into smaller functions',
        code: '// Refactored code example',
        reason: 'Improves readability and maintainability',
        impact: 'medium',
      });
    }
    
    return suggestions;
  }

  private async generateExplanation(_code: string, _request: CodeGenerationRequest): Promise<string> {
    return `This generated ${_request.requirements.type} implements ${_request.requirements.functionality}. The code follows ${_request.preferences.style} programming style and includes ${_request.preferences.errorHandling} error handling.`;
  }

  private async generateUsageExample(_code: string, _request: CodeGenerationRequest): Promise<string> {
    const name = this.generateMethodName(_request);
    return `// Usage example\nconst result = ${name}();\nconsole.log(result);`;
  }

  private async generateTests(_code: string, _request: CodeGenerationRequest): Promise<string> {
    return `// Generated tests\nimport { describe, it, expect } from '@jest/globals';\n\ndescribe('${this.generateMethodName(_request)}', () => {\n  it('should handle valid input', async () => {\n    // Test implementation\n  });\n});`;
  }

  private async generateDocumentation(_code: string, _request: CodeGenerationRequest): Promise<string> {
    return `/**\n * ${_request.requirements.functionality}\n * \n * @description Generated using AI Code Generator\n * @author guardrail AI\n * @version 1.0.0\n */`;
  }

  private estimateTokens(code: string): number {
    return Math.ceil(code.length / 4);
  }

  private calculateConfidence(code: string, request: CodeGenerationRequest): number {
    let confidence = 0.8;
    
    if (code.includes('//')) confidence += 0.05;
    if (code.includes('try') && code.includes('catch')) confidence += 0.05;
    if (request.requirements.testing?.unitTests && code.includes('test')) confidence += 0.05;
    
    return Math.min(confidence, 1.0);
  }

  private async optimizeCode(code: string, options: {
    target?: 'performance' | 'readability' | 'size';
    language: string;
  }): Promise<string> {
    console.log(`Optimizing code for: ${options.target || 'readability'}`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`// Optimized code\n${code}`);
      }, 500);
    });
  }

  private async refactorCode(code: string, refactorType: 'extract-function' | 'rename-variable' | 'simplify-logic'): Promise<string> {
    console.log(`Refactoring code: ${refactorType}`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`// Refactored code\n${code}`);
      }, 500);
    });
  }

  private async translateCode(code: string, fromLanguage: string, toLanguage: string): Promise<string> {
    console.log(`Translating code from ${fromLanguage} to ${toLanguage}`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`// Translated code to ${toLanguage}\n${code}`);
      }, 1000);
    });
  }

  private async generateDocumentationForCode(code: string, language: string): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`/**\n * Auto-generated documentation\n * \n * @description This code was documented by AI\n */\n${code}`);
      }, 500);
    });
  }

  async getGenerationMetrics(): Promise<{
    totalGenerations: number;
    averageGenerationTime: number;
    mostUsedLanguages: { language: string; count: number }[];
    averageQualityScore: number;
    tokenUsage: number;
  }> {
    const languages: { [key: string]: number } = {};
    let totalTime = 0;
    let totalQuality = 0;
    let totalTokens = 0;

    for (const request of this.generationHistory) {
      languages[request.context.language] = (languages[request.context.language] || 0) + 1;
    }

    for (const code of this.codeCache.values()) {
      totalTime += code.metadata.generationTime;
      totalQuality += code.quality.score;
      totalTokens += code.metadata.tokens;
    }

    return {
      totalGenerations: this.generationHistory.length,
      averageGenerationTime: this.codeCache.size > 0 ? totalTime / this.codeCache.size : 0,
      mostUsedLanguages: Object.entries(languages)
        .map(([language, count]) => ({ language, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      averageQualityScore: this.codeCache.size > 0 ? totalQuality / this.codeCache.size : 0,
      tokenUsage: totalTokens,
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  private generateCodeId(): string {
    return `code_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }
}

export interface CodeTemplate {
  name: string;
  language: string;
  template: string;
  description?: string;
  variables?: string[];
}

export const aiCodeGenerator = new AICodeGenerator();
