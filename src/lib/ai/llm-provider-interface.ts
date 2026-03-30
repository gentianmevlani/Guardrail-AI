/**
 * Enhanced LLM Provider Interface
 * 
 * Defines the standard interface for all LLM providers
 */

export interface LLMProvider {
  name: string;
  models: string[];
  capabilities: LLMCapability[];
  
  /**
   * Generate completion from prompt
   */
  complete(prompt: string, options?: CompletionOptions): Promise<LLMResponse>;
  
  /**
   * Generate streaming completion
   */
  completeStream(prompt: string, options?: CompletionOptions): AsyncGenerator<string>;
  
  /**
   * Generate embedding for text
   */
  embed(text: string, options?: EmbeddingOptions): Promise<number[]>;
  
  /**
   * Get provider metrics
   */
  getMetrics(): ProviderMetrics;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
  system?: string;
  context?: string;
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
  reasoning?: string;
  confidence?: number;
}

export interface LLMCapability {
  type: 'completion' | 'embedding' | 'function-calling' | 'vision' | 'code';
  supported: boolean;
  details?: string;
}

export interface ProviderMetrics {
  requestCount: number;
  successRate: number;
  averageLatency: number;
  errorCount: number;
  lastError?: string;
  quotaUsed?: number;
  quotaLimit?: number;
}

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'cohere' | 'local' | 'custom';

export interface CodeAnalysisRequest {
  code: string;
  language: string;
  filePath?: string;
  context?: string;
  analysisType: 'security' | 'performance' | 'quality' | 'architecture' | 'comprehensive';
}

export interface CodeAnalysisResult {
  issues: CodeIssue[];
  suggestions: CodeSuggestion[];
  metrics: CodeMetrics;
  summary: string;
  confidence: number;
}

export interface CodeIssue {
  type: 'error' | 'warning' | 'info';
  category: 'security' | 'performance' | 'maintainability' | 'bug' | 'style';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  line?: number;
  column?: number;
  rule?: string;
  fix?: CodeFix;
}

export interface CodeSuggestion {
  type: 'optimization' | 'refactor' | 'pattern' | 'security' | 'best-practice';
  title: string;
  description: string;
  code?: string;
  reason: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;
}

export interface CodeFix {
  type: 'automatic' | 'manual';
  description: string;
  code?: string;
  steps?: string[];
}

export interface CodeMetrics {
  complexity: number;
  maintainability: number;
  testCoverage?: number;
  duplicateLines?: number;
  linesOfCode: number;
  technicalDebt?: number;
}

export interface RecommendationRequest {
  code: string;
  context: any;
  preferences?: any;
  session?: any;
}
