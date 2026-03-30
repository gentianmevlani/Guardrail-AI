/**
 * LLM-Powered Analysis Engine
 *
 * Uses OpenAI/Anthropic to:
 * - Detect fake features that static analysis misses
 * - Generate explanations for findings
 * - Score confidence of detections
 * - Batch process for token efficiency
 */

import { Finding } from "./static-analyzer";

// ============================================================================
// TYPES
// ============================================================================

export interface LLMConfig {
  provider: "openai" | "anthropic";
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMFinding extends Finding {
  aiExplanation: string;
  aiGenerated: true;
}

export interface BatchAnalysisResult {
  findings: LLMFinding[];
  tokensUsed: number;
  cost: number;
  duration: number;
}

export interface CodeContext {
  file: string;
  content: string;
  language: string;
  imports: string[];
  exports: string[];
}

// ============================================================================
// PROMPTS
// ============================================================================

const SYSTEM_PROMPT = `You are an expert code reviewer specializing in detecting "fake features" - code that appears functional but doesn't actually work. Your job is to analyze code and identify:

1. **Stub Implementations**: Functions that throw "not implemented" errors or only log to console
2. **Hardcoded Returns**: Functions that always return the same value regardless of input
3. **Mock Data**: Code using placeholder data like "John Doe", "example.com", "lorem ipsum"
4. **Fake API Calls**: Calls to mock endpoints like jsonplaceholder.typicode.com or localhost
5. **Dead Code**: Unreachable code paths or unused exports
6. **TODO Placeholders**: TODOs/FIXMEs that indicate missing implementation
7. **Incomplete Logic**: Functions that handle only happy paths without error handling
8. **UI-Only Features**: Components that render but don't actually persist/fetch data

For each issue found, provide:
- Type of issue
- Severity (critical/warning/info)
- Line number(s)
- Clear explanation of WHY this is a fake feature
- Confidence score (0.0-1.0)
- Suggested fix

Respond in JSON format only.`;

const ANALYSIS_PROMPT = `Analyze this code file for fake features and incomplete implementations:

File: {FILE_PATH}
Language: {LANGUAGE}

\`\`\`{LANGUAGE}
{CODE}
\`\`\`

Return a JSON array of findings. Each finding should have:
{
  "type": "fake_feature|stub_implementation|mock_data|fake_api|dead_code|todo_placeholder|incomplete_logic|ui_only",
  "severity": "critical|warning|info",
  "line": number,
  "endLine": number (optional),
  "title": "short title",
  "message": "detailed explanation",
  "confidence": 0.0-1.0,
  "suggestion": "how to fix"
}

If no issues found, return an empty array: []
Only return valid JSON, no markdown or explanations.`;

const EXPLAIN_PROMPT = `Explain this code issue in simple terms for a developer who may have used AI to generate this code:

Issue Type: {TYPE}
File: {FILE}
Line: {LINE}
Code:
\`\`\`
{CODE}
\`\`\`

Original message: {MESSAGE}

Provide a 2-3 sentence explanation that:
1. Explains what the problem is
2. Explains why this is problematic in production
3. Suggests how to fix it

Keep it concise and actionable.`;

// ============================================================================
// LLM ANALYZER CLASS
// ============================================================================

export class LLMAnalyzer {
  private config: LLMConfig | null = null;
  private tokensUsed = 0;

  /**
   * Initialize with API configuration
   */
  initialize(config: LLMConfig): void {
    this.config = {
      ...config,
      model:
        config.model ||
        (config.provider === "openai"
          ? "gpt-4o-mini"
          : "claude-3-haiku-20240307"),
      maxTokens: config.maxTokens || 2000,
      temperature: config.temperature || 0.1,
    };
  }

  /**
   * Check if analyzer is initialized
   */
  isInitialized(): boolean {
    return this.config !== null;
  }

  /**
   * Get current provider
   */
  getProvider(): string | null {
    return this.config?.provider || null;
  }

  /**
   * Analyze code for fake features using LLM
   */
  async analyzeCode(context: CodeContext): Promise<LLMFinding[]> {
    if (!this.config) {
      throw new Error("LLM Analyzer not initialized. Call initialize() first.");
    }

    const prompt = ANALYSIS_PROMPT.replace("{FILE_PATH}", context.file)
      .replace(/{LANGUAGE}/g, context.language)
      .replace("{CODE}", context.content.substring(0, 8000)); // Limit for token efficiency

    try {
      const response = await this.callLLM(prompt);
      const findings = this.parseFindings(response, context.file);
      return findings;
    } catch (error) {
      console.error("LLM analysis failed:", error);
      return [];
    }
  }

  /**
   * Batch analyze multiple files
   */
  async batchAnalyze(contexts: CodeContext[]): Promise<BatchAnalysisResult> {
    const startTime = Date.now();
    const allFindings: LLMFinding[] = [];
    this.tokensUsed = 0;

    // Process in batches of 3 for rate limiting
    const batchSize = 3;
    for (let i = 0; i < contexts.length; i += batchSize) {
      const batch = contexts.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((ctx) => this.analyzeCode(ctx)),
      );
      allFindings.push(...results.flat());

      // Rate limit delay between batches
      if (i + batchSize < contexts.length) {
        await this.delay(1000);
      }
    }

    // Calculate estimated cost
    const cost = this.estimateCost(this.tokensUsed);

    return {
      findings: allFindings,
      tokensUsed: this.tokensUsed,
      cost,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Generate explanation for a finding
   */
  async explainFinding(finding: Finding): Promise<string> {
    if (!this.config) {
      return finding.message;
    }

    const prompt = EXPLAIN_PROMPT.replace("{TYPE}", finding.type)
      .replace("{FILE}", finding.file)
      .replace("{LINE}", String(finding.line))
      .replace("{CODE}", finding.codeSnippet || "")
      .replace("{MESSAGE}", finding.message);

    try {
      const response = await this.callLLM(prompt);
      return response.trim();
    } catch {
      return finding.message;
    }
  }

  /**
   * Call LLM API
   */
  private async callLLM(userPrompt: string): Promise<string> {
    if (!this.config) throw new Error("Not initialized");

    if (this.config.provider === "openai") {
      return this.callOpenAI(userPrompt);
    } else {
      return this.callAnthropic(userPrompt);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(userPrompt: string): Promise<string> {
    if (!this.config) throw new Error("Not initialized");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { total_tokens: number };
    };

    this.tokensUsed += data.usage?.total_tokens || 0;
    return data.choices[0]?.message?.content || "";
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(userPrompt: string): Promise<string> {
    if (!this.config) throw new Error("Not initialized");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    this.tokensUsed +=
      (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    return data.content[0]?.text || "";
  }

  /**
   * Parse LLM response into findings
   */
  private parseFindings(response: string, file: string): LLMFinding[] {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(jsonStr);
      const findings: LLMFinding[] = [];

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          findings.push({
            type: this.mapFindingType(item.type),
            severity: this.validateSeverity(item.severity),
            category: "fake_feature",
            file,
            line: item.line || 1,
            column: 0,
            endLine: item.endLine,
            title: item.title || "AI-detected issue",
            message: item.message || "Issue detected by AI analysis",
            codeSnippet: item.codeSnippet,
            suggestion: item.suggestion,
            confidence: Math.min(1, Math.max(0, item.confidence || 0.7)),
            ruleId: `ai-${item.type || "unknown"}`,
            aiExplanation: item.message,
            aiGenerated: true,
          });
        }
      }

      return findings;
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      return [];
    }
  }

  /**
   * Map LLM finding type to standard type
   */
  private mapFindingType(type: string): Finding["type"] {
    const mapping: Record<string, Finding["type"]> = {
      fake_feature: "fake_feature",
      stub_implementation: "stub_implementation",
      mock_data: "mock_data",
      fake_api: "fake_api_call",
      dead_code: "unreachable_code",
      todo_placeholder: "todo_without_impl",
      incomplete_logic: "stub_implementation",
      ui_only: "fake_feature",
      hardcoded_return: "hardcoded_return",
      empty_function: "empty_function",
      console_only: "console_only",
    };
    return mapping[type] || "fake_feature";
  }

  /**
   * Validate severity value
   */
  private validateSeverity(severity: string): "critical" | "warning" | "info" {
    if (["critical", "warning", "info"].includes(severity)) {
      return severity as "critical" | "warning" | "info";
    }
    return "warning";
  }

  /**
   * Estimate cost based on tokens
   */
  private estimateCost(tokens: number): number {
    if (!this.config) return 0;

    // Approximate costs per 1K tokens (as of 2024)
    const costs: Record<string, number> = {
      "gpt-4o-mini": 0.00015,
      "gpt-4o": 0.005,
      "gpt-4-turbo": 0.01,
      "claude-3-haiku-20240307": 0.00025,
      "claude-3-sonnet-20240229": 0.003,
      "claude-3-opus-20240229": 0.015,
    };

    const costPer1K = costs[this.config.model || ""] || 0.001;
    return (tokens / 1000) * costPer1K;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get tokens used in current session
   */
  getTokensUsed(): number {
    return this.tokensUsed;
  }

  /**
   * Reset token counter
   */
  resetTokenCounter(): void {
    this.tokensUsed = 0;
  }
}

// Export singleton instance
export const llmAnalyzer = new LLMAnalyzer();
