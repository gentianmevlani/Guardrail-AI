/**
 * AI-Powered Code Suggestion Service
 *
 * Provides intelligent code completion, refactoring suggestions,
 * and security recommendations using multiple AI providers
 */

import { logger } from "../logger";
import { getEnv } from "@guardrail/core";

interface CodeContext {
  language: string;
  framework?: string;
  filePath: string;
  content: string;
  cursor?: {
    line: number;
    column: number;
  };
  imports?: string[];
  functions?: string[];
  variables?: string[];
}

interface SuggestionRequest {
  type:
    | "completion"
    | "refactor"
    | "security"
    | "optimization"
    | "documentation";
  context: CodeContext;
  prompt?: string;
  maxSuggestions?: number;
}

interface CodeSuggestion {
  type: string;
  title: string;
  description: string;
  code: string;
  confidence: number;
  impact: "low" | "medium" | "high";
  category: "security" | "performance" | "maintainability" | "best-practice";
  appliesAt?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  explanation?: string;
  references?: string[];
}

interface AIProvider {
  name: string;
  generateCodeCompletion(context: CodeContext): Promise<CodeSuggestion[]>;
  generateRefactoring(context: CodeContext): Promise<CodeSuggestion[]>;
  generateSecurityAnalysis(context: CodeContext): Promise<CodeSuggestion[]>;
  generateOptimization(context: CodeContext): Promise<CodeSuggestion[]>;
  generateDocumentation(context: CodeContext): Promise<CodeSuggestion[]>;
}

class OpenAIProvider implements AIProvider {
  name = "OpenAI";
  private apiKey: string;
  private logger = logger.child({ provider: "openai" });

  constructor() {
    this.apiKey = process.env["OPENAI_API_KEY"] || "";

    if (!this.apiKey) {
      this.logger.warn("OpenAI API key not configured");
    }
  }

  async generateCodeCompletion(
    context: CodeContext,
  ): Promise<CodeSuggestion[]> {
    if (!this.apiKey) return [];

    try {
      const prompt = this.buildCompletionPrompt(context);
      const response = await this.callOpenAI(prompt);
      return this.parseCompletionResponse(response, context);
    } catch (error) {
      this.logger.error({ error }, "Failed to generate code completion");
      return [];
    }
  }

  async generateRefactoring(context: CodeContext): Promise<CodeSuggestion[]> {
    if (!this.apiKey) return [];

    try {
      const prompt = this.buildRefactorPrompt(context);
      const response = await this.callOpenAI(prompt);
      return this.parseRefactorResponse(response, context);
    } catch (error) {
      this.logger.error(
        { error },
        "Failed to generate refactoring suggestions",
      );
      return [];
    }
  }

  async generateSecurityAnalysis(
    context: CodeContext,
  ): Promise<CodeSuggestion[]> {
    if (!this.apiKey) return [];

    try {
      const prompt = this.buildSecurityPrompt(context);
      const response = await this.callOpenAI(prompt);
      return this.parseSecurityResponse(response, context);
    } catch (error) {
      this.logger.error({ error }, "Failed to generate security analysis");
      return [];
    }
  }

  async generateOptimization(context: CodeContext): Promise<CodeSuggestion[]> {
    if (!this.apiKey) return [];

    try {
      const prompt = this.buildOptimizationPrompt(context);
      const response = await this.callOpenAI(prompt);
      return this.parseOptimizationResponse(response, context);
    } catch (error) {
      this.logger.error(
        { error },
        "Failed to generate optimization suggestions",
      );
      return [];
    }
  }

  async generateDocumentation(context: CodeContext): Promise<CodeSuggestion[]> {
    if (!this.apiKey) return [];

    try {
      const prompt = this.buildDocumentationPrompt(context);
      const response = await this.callOpenAI(prompt);
      return this.parseDocumentationResponse(response, context);
    } catch (error) {
      this.logger.error({ error }, "Failed to generate documentation");
      return [];
    }
  }

  private async callOpenAI(prompt: string): Promise<unknown> {
    // Dynamic import to avoid loading OpenAI if not configured
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: this.apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    return JSON.parse(completion.choices[0].message.content || "{}");
  }

  private buildCompletionPrompt(context: CodeContext): string {
    return `
You are an expert code completion AI. Analyze the following code and provide intelligent completions.

Language: ${context.language}
Framework: ${context.framework || "None"}
File: ${context.filePath}

Code around cursor:
\`\`\`${context.language}
${this.extractCodeAroundCursor(context.content, context.cursor)}
\`\`\`

Provide 3-5 code completion suggestions in JSON format:
{
  "suggestions": [
    {
      "code": "completed code here",
      "description": "what this code does",
      "confidence": 0.9,
      "explanation": "why this is a good suggestion"
    }
  ]
}
    `;
  }

  private buildRefactorPrompt(context: CodeContext): string {
    return `
You are an expert code refactoring AI. Analyze the following code and suggest improvements.

Language: ${context.language}
Framework: ${context.framework || "None"}
File: ${context.filePath}

Code:
\`\`\`${context.language}
${context.content}
\`\`\`

Provide refactoring suggestions in JSON format:
{
  "suggestions": [
    {
      "title": "Extract to function",
      "description": "Extract this logic into a reusable function",
      "code": "refactored code here",
      "confidence": 0.85,
      "impact": "medium",
      "explanation": "This improves maintainability and reusability"
    }
  ]
}
    `;
  }

  private buildSecurityPrompt(context: CodeContext): string {
    return `
You are a security expert AI. Analyze the following code for security vulnerabilities.

Language: ${context.language}
Framework: ${context.framework || "None"}
File: ${context.filePath}

Code:
\`\`\`${context.language}
${context.content}
\`\`\`

Identify security issues and provide fixes in JSON format:
{
  "vulnerabilities": [
    {
      "title": "SQL Injection Risk",
      "description": "Direct query concatenation vulnerable to SQL injection",
      "code": "secure code here",
      "confidence": 0.95,
      "impact": "high",
      "cve": "CVE-2023-XXXX",
      "explanation": "Use parameterized queries instead"
    }
  ]
}
    `;
  }

  private buildOptimizationPrompt(context: CodeContext): string {
    return `
You are a performance optimization expert. Analyze the following code for performance improvements.

Language: ${context.language}
Framework: ${context.framework || "None"}
File: ${context.filePath}

Code:
\`\`\`${context.language}
${context.content}
\`\`\`

Provide optimization suggestions in JSON format:
{
  "optimizations": [
    {
      "title": "Use memoization",
      "description": "Cache expensive function calls",
      "code": "optimized code here",
      "confidence": 0.8,
      "impact": "medium",
      "improvement": "Reduces time complexity from O(n²) to O(n)"
    }
  ]
}
    `;
  }

  private buildDocumentationPrompt(context: CodeContext): string {
    return `
You are a documentation expert. Generate comprehensive documentation for the following code.

Language: ${context.language}
Framework: ${context.framework || "None"}
File: ${context.filePath}

Code:
\`\`\`${context.language}
${context.content}
\`\`\`

Generate documentation in JSON format:
{
  "documentation": [
    {
      "type": "jsdoc",
      "title": "Function documentation",
      "code": "/**\\n * Function description\\n * @param {...} description\\n * @returns {...} description\\n */",
      "confidence": 0.9
    }
  ]
}
    `;
  }

  private extractCodeAroundCursor(
    content: string,
    cursor?: { line: number; column: number },
  ): string {
    if (!cursor) return content;

    const lines = content.split("\n");
    const startLine = Math.max(0, cursor.line - 5);
    const endLine = Math.min(lines.length - 1, cursor.line + 5);

    return lines.slice(startLine, endLine + 1).join("\n");
  }

  private parseCompletionResponse(
    response: any,
    context: CodeContext,
  ): CodeSuggestion[] {
    return (response.suggestions || []).map((s: any) => ({
      type: "completion",
      title: s.code.substring(0, 50) + "...",
      description: s.description,
      code: s.code,
      confidence: s.confidence || 0.5,
      impact: "low" as const,
      category: "best-practice" as const,
      explanation: s.explanation,
    }));
  }

  private parseRefactorResponse(
    response: any,
    context: CodeContext,
  ): CodeSuggestion[] {
    return (response.suggestions || []).map((s: any) => ({
      type: "refactor",
      title: s.title,
      description: s.description,
      code: s.code,
      confidence: s.confidence || 0.5,
      impact: s.impact || "medium",
      category: "maintainability" as const,
      explanation: s.explanation,
    }));
  }

  private parseSecurityResponse(
    response: any,
    context: CodeContext,
  ): CodeSuggestion[] {
    return (response.vulnerabilities || []).map((v: any) => ({
      type: "security",
      title: v.title,
      description: v.description,
      code: v.code,
      confidence: v.confidence || 0.5,
      impact: v.impact || "high",
      category: "security" as const,
      explanation: v.explanation,
      references: v.cve ? [v.cve] : [],
    }));
  }

  private parseOptimizationResponse(
    response: any,
    context: CodeContext,
  ): CodeSuggestion[] {
    return (response.optimizations || []).map((o: any) => ({
      type: "optimization",
      title: o.title,
      description: o.description,
      code: o.code,
      confidence: o.confidence || 0.5,
      impact: o.impact || "medium",
      category: "performance" as const,
      explanation: o.improvement,
    }));
  }

  private parseDocumentationResponse(
    response: any,
    context: CodeContext,
  ): CodeSuggestion[] {
    return (response.documentation || []).map((d: any) => ({
      type: "documentation",
      title: d.title,
      description: "Generated documentation",
      code: d.code,
      confidence: d.confidence || 0.5,
      impact: "low",
      category: "best-practice" as const,
    }));
  }
}

class AnthropicProvider implements AIProvider {
  name = "Anthropic";
  private apiKey: string;
  private logger = logger.child({ provider: "anthropic" });

  constructor() {
    this.apiKey = process.env["ANTHROPIC_API_KEY"] || "";

    if (!this.apiKey) {
      this.logger.warn("Anthropic API key not configured");
    }
  }

  // Similar implementation for Anthropic Claude
  async generateCodeCompletion(
    context: CodeContext,
  ): Promise<CodeSuggestion[]> {
    // Implementation for Claude
    return [];
  }

  async generateRefactoring(_context: CodeContext): Promise<CodeSuggestion[]> {
    return [];
  }

  async generateSecurityAnalysis(
    _context: CodeContext,
  ): Promise<CodeSuggestion[]> {
    return [];
  }

  async generateOptimization(_context: CodeContext): Promise<CodeSuggestion[]> {
    return [];
  }

  async generateDocumentation(
    _context: CodeContext,
  ): Promise<CodeSuggestion[]> {
    return [];
  }
}

export class CodeSuggestionService {
  private providers: AIProvider[] = [];
  private logger = logger.child({ service: "code-suggestions" });

  constructor() {
    // Initialize available providers
    if (getEnv().OPENAI_API_KEY) {
      this.providers.push(new OpenAIProvider());
    }
    if (process.env["ANTHROPIC_API_KEY"]) {
      this.providers.push(new AnthropicProvider());
    }

    this.logger.info(
      {
        providers: this.providers.map((p) => p.name),
      },
      "Code suggestion service initialized",
    );
  }

  async getSuggestions(request: SuggestionRequest): Promise<CodeSuggestion[]> {
    const allSuggestions: CodeSuggestion[] = [];

    // Get suggestions from all available providers
    for (const provider of this.providers) {
      try {
        let suggestions: CodeSuggestion[] = [];

        switch (request.type) {
          case "completion":
            suggestions = await provider.generateCodeCompletion(
              request.context,
            );
            break;
          case "refactor":
            suggestions = await provider.generateRefactoring(request.context);
            break;
          case "security":
            suggestions = await provider.generateSecurityAnalysis(
              request.context,
            );
            break;
          case "optimization":
            suggestions = await provider.generateOptimization(request.context);
            break;
          case "documentation":
            suggestions = await provider.generateDocumentation(request.context);
            break;
        }

        // Add provider info to suggestions
        suggestions.forEach((s) => {
          (s as any).provider = provider.name;
        });

        allSuggestions.push(...suggestions);
      } catch (error) {
        this.logger.error(
          {
            error,
            provider: provider.name,
            type: request.type,
          },
          "Provider failed to generate suggestions",
        );
      }
    }

    // Sort by confidence and limit results
    const sorted = allSuggestions.sort((a, b) => b.confidence - a.confidence);
    return sorted.slice(0, request.maxSuggestions || 10);
  }

  async getRealTimeSuggestions(
    context: CodeContext,
  ): Promise<CodeSuggestion[]> {
    // Optimized for real-time code completion
    const request: SuggestionRequest = {
      type: "completion",
      context,
      maxSuggestions: 5,
    };

    return this.getSuggestions(request);
  }

  async analyzeCodeSecurity(context: CodeContext): Promise<CodeSuggestion[]> {
    const request: SuggestionRequest = {
      type: "security",
      context,
    };

    return this.getSuggestions(request);
  }

  async suggestRefactoring(context: CodeContext): Promise<CodeSuggestion[]> {
    const request: SuggestionRequest = {
      type: "refactor",
      context,
    };

    return this.getSuggestions(request);
  }

  async optimizePerformance(context: CodeContext): Promise<CodeSuggestion[]> {
    const request: SuggestionRequest = {
      type: "optimization",
      context,
    };

    return this.getSuggestions(request);
  }

  async generateDocs(context: CodeContext): Promise<CodeSuggestion[]> {
    const request: SuggestionRequest = {
      type: "documentation",
      context,
    };

    return this.getSuggestions(request);
  }
}

// Export singleton instance
export const codeSuggestionService = new CodeSuggestionService();
