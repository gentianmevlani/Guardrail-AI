# Advanced AI Integration for guardrail

This module provides comprehensive AI capabilities for guardrail, including:

- **Multiple LLM Provider Support** - OpenAI, Anthropic Claude, and more
- **Smart Code Analysis** - AI-powered code review and insights
- **Contextual Recommendations** - Personalized suggestions based on context
- **Continuous Learning** - System improves from feedback
- **Real-time Streaming** - Stream responses for better UX
- **Cost Optimization** - Intelligent provider selection and caching

## Quick Start

### Installation

1. Install dependencies:
   ```bash
   # Using npm
   npm install openai @anthropic-ai/sdk
   
   # Or run the installation script
   # On macOS/Linux:
   chmod +x install-dependencies.sh
   ./install-dependencies.sh
   
   # On Windows:
   install-dependencies.bat
   ```

2. Set environment variables:
   ```bash
   export OPENAI_API_KEY=your_openai_api_key
   export ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

3. Start using the AI integration:
   ```typescript
   import { aiHub } from './src/lib/ai';
   
   // Analyze code
   const analysis = await aiHub.analyzeCode({
     code: 'function example() { return true; }',
     language: 'javascript',
     analysisType: 'comprehensive'
   });
   ```

## Architecture

### Core Components

1. **AI Hub** (`ai-hub.ts`) - Central orchestrator for all AI operations
2. **Providers** (`providers/`) - LLM provider implementations
3. **Smart Analyzer** (`smart-code-analyzer.ts`) - Advanced code analysis
4. **Recommendation System** (`contextual-recommendation-system.ts`) - Context-aware suggestions
5. **Learning System** (`learning-system.ts`) - Continuous improvement from feedback

### Provider Architecture

```typescript
interface LLMProvider {
  complete(prompt: string, options?: CompletionOptions): Promise<LLMResponse>;
  completeStream(prompt: string, options?: CompletionOptions): AsyncGenerator<string>;
  embed(text: string, options?: EmbeddingOptions): Promise<number[]>;
  analyzeCode(request: CodeAnalysisRequest): Promise<CodeAnalysisResult>;
  isAvailable(): boolean;
  getMetrics(): ProviderMetrics;
}
```

## Features

### 1. Multi-Provider Support

Support for multiple LLM providers with automatic fallback:

```typescript
// Configure providers
const config = {
  providers: [
    { name: 'openai', enabled: true, priority: 1 },
    { name: 'anthropic', enabled: true, priority: 2 }
  ],
  defaultProvider: 'openai',
  fallbackProviders: ['anthropic']
};

aiHub.updateConfig(config);
```

### 2. Smart Code Analysis

Comprehensive code analysis with multiple types:

```typescript
const analysis = await aiHub.analyzeCode({
  code: sourceCode,
  language: 'typescript',
  filePath: 'src/components/Button.tsx',
  analysisType: 'security', // or 'performance', 'quality', 'architecture'
  context: 'React component in a large e-commerce application'
});

// Results include:
// - Issues with fixes
// - Suggestions for improvement
// - Code metrics
// - Confidence scores
```

### 3. Contextual Recommendations

Personalized recommendations based on:

- User skill level and preferences
- Project patterns and standards
- Team dynamics
- Current context (time, session, recent activity)

```typescript
const recommendations = await aiHub.getRecommendations(code, {
  project: { framework: 'react', size: 'large' },
  user: { role: 'senior', experience: 5 },
  environment: { timeOfDay: 'morning' }
});
```

### 4. Continuous Learning

System learns from feedback to improve recommendations:

```typescript
// Provide feedback
aiHub.addFeedback({
  type: 'positive',
  suggestionId: 'rec_001',
  userId: 'user123',
  outcome: { applied: true, success: true, impact: 8 }
});

// Get learning insights
const insights = aiLearningSystem.getLearningInsights();
```

### 5. Streaming Support

Stream responses for real-time interaction:

```typescript
for await (const chunk of aiHub.completeStream(prompt, {
  model: 'gpt-4-turbo',
  temperature: 0.7
})) {
  // Process chunk as it arrives
  process.stdout.write(chunk);
}
```

### 6. Batch Processing

Process multiple requests efficiently:

```typescript
const requests = [
  { type: 'completion', input: 'Explain closures' },
  { type: 'analysis', input: codeToAnalyze },
  { type: 'embedding', input: 'text to embed' }
];

const responses = await aiHub.batchProcess(requests);
```

## Configuration

### Environment Variables

```bash
# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_ORG_ID=your_org_id

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_key

# Optional: Custom endpoints
OPENAI_BASE_URL=https://api.openai.com
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

### Provider Configuration

```typescript
const config = {
  providers: [
    {
      name: 'openai',
      enabled: true,
      apiKey: process.env.OPENAI_API_KEY,
      models: [
        { name: 'gpt-4-turbo-preview', type: 'completion', maxTokens: 4096 },
        { name: 'text-embedding-3-small', type: 'embedding', maxTokens: 8192 }
      ],
      rateLimit: {
        requestsPerMinute: 3500,
        tokensPerMinute: 90000
      }
    }
  ],
  cacheEnabled: true,
  metricsEnabled: true
};
```

## API Reference

### AI Hub

#### `complete(prompt, options)`
Generate text completion.

#### `completeStream(prompt, options)`
Generate streaming completion.

#### `analyzeCode(request, options)`
Analyze code for issues, suggestions, and metrics.

#### `getRecommendations(code, context, options)`
Get contextual recommendations.

#### `embed(text, options)`
Generate text embeddings.

#### `batchProcess(requests)`
Process multiple requests in parallel.

#### `healthCheck()`
Check health of all providers.

#### `getMetrics()`
Get system metrics and usage statistics.

### Code Analysis Request

```typescript
interface CodeAnalysisRequest {
  code: string;
  language: string;
  filePath?: string;
  context?: string;
  analysisType: 'security' | 'performance' | 'quality' | 'architecture' | 'comprehensive';
}
```

### Completion Options

```typescript
interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  system?: string;
  context?: string;
  stream?: boolean;
}
```

## Best Practices

### 1. Provider Selection

- Use **OpenAI GPT-4** for complex reasoning and code generation
- Use **Anthropic Claude** for security analysis and nuanced understanding
- Use **embeddings** for semantic search and similarity matching

### 2. Cost Optimization

- Enable caching for repeated requests
- Use appropriate models (GPT-3.5 for simple tasks, GPT-4 for complex ones)
- Monitor usage with metrics
- Set rate limits to control costs

### 3. Performance

- Use streaming for long responses
- Batch process multiple requests
- Enable async processing
- Use fallback providers for reliability

### 4. Security

- Never log API keys
- Use environment variables for credentials
- Implement proper access controls
- Validate and sanitize inputs

## Examples

See `examples.ts` for comprehensive usage examples including:

- Basic code analysis
- Contextual recommendations
- Streaming generation
- Project-wide analysis
- Learning from feedback
- Batch processing
- Health checks
- Custom configuration

## Monitoring and Metrics

The system provides detailed metrics:

```typescript
const metrics = aiHub.getMetrics();
console.log({
  totalRequests: metrics.totalRequests,
  successRate: metrics.successfulRequests / metrics.totalRequests,
  averageLatency: metrics.averageLatency,
  costUsage: metrics.costUsage,
  providerMetrics: metrics.providerMetrics
});
```

## Error Handling

The system implements robust error handling:

- Automatic fallback to alternative providers
- Retry logic with exponential backoff
- Graceful degradation when providers are unavailable
- Detailed error reporting

## Contributing

To add a new provider:

1. Implement the `LLMProvider` interface
2. Add provider configuration
3. Register with the AI Hub
4. Add tests

Example:

```typescript
class CustomProvider implements LLMProvider {
  name = 'custom';
  
  async complete(prompt: string, options?: CompletionOptions): Promise<LLMResponse> {
    // Implementation
  }
  
  // ... other methods
}

// Register
aiHub.registerProvider(new CustomProvider());
```

## License

This module is part of guardrail and follows the same license terms.

---

*Context Enhanced by guardrail AI*
