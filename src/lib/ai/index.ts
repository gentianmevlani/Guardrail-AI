/**
 * AI Integration Module Index
 * 
 * Central exports for all AI capabilities
 */

// Core interfaces and types
export type {
  LLMProvider,
  CompletionOptions,
  EmbeddingOptions,
  LLMResponse,
  LLMCapability,
  ProviderMetrics,
  CodeAnalysisRequest,
  CodeAnalysisResult,
  CodeIssue,
  CodeSuggestion,
  CodeFix,
  CodeMetrics
} from './llm-provider-interface';

// Main AI Hub
export { aiHub, AIIntegrationHub } from './ai-hub';
export type {
  AIHubConfig,
  ProviderConfig,
  ModelConfig,
  RateLimit,
  AIRequest,
  AIResponse,
  TokenUsage,
  AIMetrics,
  CostUsage,
  ProviderMetrics as AIProviderMetrics
} from './ai-hub';

// Providers
export { OpenAIProvider } from './providers/openai-provider';
export { AnthropicProvider } from './providers/anthropic-provider';

// Smart Code Analyzer
export { smartCodeAnalyzer, SmartCodeAnalyzer } from './smart-code-analyzer';
export type {
  SmartAnalysisConfig,
  CustomRule,
  AnalysisContext,
  GitCommit,
  TeamStandards,
  LearningData as SmartLearningData,
  AnalysisFeedback
} from './smart-code-analyzer';

// Contextual Recommendation System
export { contextualRecommendationSystem, ContextualRecommendationSystem } from './contextual-recommendation-system';
export type {
  RecommendationConfig,
  RecommendationCategory,
  RecommendationRule,
  RecommendationRequest,
  RecommendationContext,
  ProjectContext,
  FileContext,
  UserContext,
  UserPreferences,
  UserHistory,
  CodeEdit,
  SkillProgress,
  EnvironmentContext,
  Activity,
  ProjectStandards,
  TestingRequirements,
  PerformanceTargets,
  RecommendationSession,
  RecommendationEvent,
  EnhancedRecommendation,
  RecommendationExplanation,
  CodeExample,
  LearningResource
} from './contextual-recommendation-system';

// Learning System
export { aiLearningSystem, AILearningSystem } from './learning-system';
export type {
  LearningConfig,
  LearningData,
  PatternData,
  PatternFix,
  UserBehaviorData,
  UserPattern,
  UserPreference,
  SkillLevel,
  LearningProgress,
  Achievement,
  BehaviorMetrics,
  ProjectInsightData,
  ProjectIssue,
  ProjectPattern,
  TeamDynamics,
  CodeEvolution,
  FeedbackData,
  FeedbackOutcome,
  FeedbackContext,
  ModelMetrics,
  LearningEvent,
  ReinforcementLearningState
} from './learning-system';

// Examples
export { examples } from './examples';

// Utility functions
export const createAIHub = (config?: Partial<AIHubConfig>) => {
  return new AIIntegrationHub(config);
};

export const createOpenAIProvider = (apiKey?: string) => {
  return new OpenAIProvider(apiKey);
};

export const createAnthropicProvider = (apiKey?: string) => {
  return new AnthropicProvider(apiKey);
};

// Default configurations
export const defaultConfig: AIHubConfig = {
  providers: [
    {
      name: 'openai',
      enabled: true,
      models: [
        { name: 'gpt-4-turbo-preview', type: 'completion', maxTokens: 4096, costPerToken: 0.00003 },
        { name: 'text-embedding-3-small', type: 'embedding', maxTokens: 8192, costPerToken: 0.00000002 }
      ],
      priority: 1,
      rateLimit: { requestsPerMinute: 3500, tokensPerMinute: 90000 }
    },
    {
      name: 'anthropic',
      enabled: true,
      models: [
        { name: 'claude-3-sonnet-20240229', type: 'completion', maxTokens: 4096, costPerToken: 0.00003 }
      ],
      priority: 2,
      rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 40000 }
    }
  ],
  enableCodeAnalysis: true,
  enableRecommendations: true,
  enableLearning: true,
  defaultProvider: 'openai',
  fallbackProviders: ['anthropic'],
  cacheEnabled: true,
  metricsEnabled: true
};

// Quick start helpers
export const quickAnalyze = async (code: string, language: string) => {
  return aiHub.analyzeCode({
    code,
    language,
    analysisType: 'comprehensive'
  });
};

export const quickComplete = async (prompt: string, options?: CompletionOptions) => {
  return aiHub.complete(prompt, options);
};

export const quickRecommend = async (code: string, context: any) => {
  return aiHub.getRecommendations(code, context);
};

// Version
export const VERSION = '1.0.0';
