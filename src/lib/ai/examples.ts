/**
 * AI Integration Examples
 * 
 * Demonstrates how to use the advanced AI integration features
 */

import { aiHub } from './ai-hub';
import { smartCodeAnalyzer } from './smart-code-analyzer';
import { contextualRecommendationSystem } from './contextual-recommendation-system';
import { aiLearningSystem } from './learning-system';
import type {
  CodeAnalysisRequest,
  CompletionOptions,
  RecommendationRequest
} from './llm-provider-interface';

/**
 * Example 1: Basic Code Analysis
 */
export async function analyzeCodeExample() {
  const code = `
    function getUserData(id) {
      return fetch('/api/users/' + id)
        .then(res => res.json())
        .then(data => {
          console.log(data);
          return data;
        });
    }
  `;

  const request: CodeAnalysisRequest = {
    code,
    language: 'javascript',
    filePath: 'src/services/user-service.js',
    analysisType: 'comprehensive'
  };

  try {
    const analysis = await aiHub.analyzeCode(request, {
      provider: 'openai',
      userId: 'user123',
      projectId: 'my-project'
    });

    console.log('Analysis Results:');
    console.log('- Issues:', analysis.issues.length);
    console.log('- Suggestions:', analysis.suggestions.length);
    console.log('- Confidence:', analysis.confidence);
    
    // Display top issues
    analysis.issues.slice(0, 3).forEach(issue => {
      console.log(`\n${issue.severity.toUpperCase()}: ${issue.message}`);
      if (issue.fix) {
        console.log(`  Fix: ${issue.fix.description}`);
      }
    });
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

/**
 * Example 2: Getting Contextual Recommendations
 */
export async function getRecommendationsExample() {
  const code = `
    const express = require('express');
    const app = express();
    
    app.get('/users/:id', async (req, res) => {
      const user = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
      res.json(user);
    });
  `;

  const request: RecommendationRequest = {
    code,
    context: {
      project: {
        path: '/my-project',
        type: 'backend',
        framework: 'express',
        dependencies: ['express', 'mysql2'],
        size: 'medium',
        architecture: 'monolith'
      },
      file: {
        path: '/routes/users.js',
        type: 'route',
        language: 'javascript',
        size: 500,
        complexity: 3,
        purpose: 'service'
      },
      user: {
        id: 'user123',
        role: 'mid',
        experience: 3,
        preferences: {
          codeStyle: 'functional',
          verbosity: 'balanced',
          learningMode: 'moderate',
          focusAreas: ['security', 'performance'],
          avoidPatterns: []
        },
        history: {
          recentEdits: [],
          acceptedSuggestions: [],
          rejectedSuggestions: [],
          skillProgress: []
        }
      },
      environment: {
        ide: 'vscode',
        os: 'windows',
        timeOfDay: 'afternoon',
        sessionDuration: 3600000,
        recentActivity: []
      }
    }
  };

  try {
    const recommendations = await aiHub.getRecommendations(code, request.context, {
      userId: 'user123',
      projectId: 'my-project'
    });

    console.log('\nRecommendations:');
    recommendations.forEach((rec, index) => {
      console.log(`\n${index + 1}. ${rec.title} (${rec.type})`);
      console.log(`   Impact: ${rec.impact} | Confidence: ${(rec.confidence * 100).toFixed(1)}%`);
      console.log(`   ${rec.description}`);
      
      if (rec.examples && rec.examples.length > 0) {
        console.log('   Example:');
        console.log('   ```' + rec.examples[0].language);
        console.log('   ' + rec.examples[0].code);
        console.log('   ```');
      }
    });
  } catch (error) {
    console.error('Failed to get recommendations:', error);
  }
}

/**
 * Example 3: Streaming Code Generation
 */
export async function generateCodeStreamExample() {
  const prompt = `
    Generate a TypeScript class for managing user authentication with:
    - Login method with JWT tokens
    - Logout method
    - Password reset functionality
    - Input validation
    - Error handling
  `;

  const options: CompletionOptions = {
    model: 'gpt-4-turbo-preview',
    temperature: 0.3,
    maxTokens: 2000,
    system: 'You are an expert TypeScript developer. Write clean, type-safe code with proper error handling.'
  };

  try {
    console.log('\nGenerated Code:');
    console.log('----------------');
    
    for await (const chunk of aiHub.completeStream(prompt, options)) {
      process.stdout.write(chunk);
    }
    
    console.log('\n----------------');
  } catch (error) {
    console.error('Code generation failed:', error);
  }
}

/**
 * Example 4: Smart Project Analysis
 */
export async function analyzeProjectExample() {
  const files = [
    {
      request: {
        code: 'app.get("/", (req, res) => res.send("Hello"));',
        language: 'javascript',
        filePath: 'server.js',
        analysisType: 'security' as const
      },
      context: {
        projectPath: '/my-api',
        fileType: 'server',
        framework: 'express'
      }
    },
    {
      request: {
        code: 'SELECT * FROM users WHERE id = ' + userId,
        language: 'sql',
        filePath: 'queries.sql',
        analysisType: 'security' as const
      },
      context: {
        projectPath: '/my-api',
        fileType: 'database',
        framework: 'mysql'
      }
    }
  ];

  try {
    const results = await smartCodeAnalyzer.analyzeProject(files);
    
    console.log('\nProject Analysis Summary:');
    for (const [path, analysis] of results) {
      console.log(`\nFile: ${path}`);
      console.log(`- Critical Issues: ${analysis.issues.filter(i => i.severity === 'critical').length}`);
      console.log(`- Security Issues: ${analysis.issues.filter(i => i.category === 'security').length}`);
      console.log(`- Performance Issues: ${analysis.issues.filter(i => i.category === 'performance').length}`);
      console.log(`- Overall Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
    }
  } catch (error) {
    console.error('Project analysis failed:', error);
  }
}

/**
 * Example 5: Learning from Feedback
 */
export async function learningExample() {
  // Simulate user feedback on recommendations
  const feedback = {
    id: 'feedback_001',
    type: 'positive' as const,
    suggestionId: 'rec_security_001',
    userId: 'user123',
    projectId: 'my-project',
    timestamp: new Date(),
    outcome: {
      applied: true,
      modified: false,
      success: true,
      impact: 8,
      effort: 3
    },
    context: {
      codeContext: 'fetch("/api/users/" + id)',
      timePressure: 0.3,
      complexity: 0.4,
      familiarity: 0.8,
      deadline: false
    },
    sentiment: 0.9
  };

  try {
    // Process feedback for learning
    await aiLearningSystem.processFeedback(feedback);
    
    // Get learning insights
    const insights = aiLearningSystem.getLearningInsights();
    
    console.log('\nLearning Insights:');
    console.log('- Model Accuracy:', (insights.modelPerformance.accuracy * 100).toFixed(1) + '%');
    console.log('- User Satisfaction:', (insights.modelPerformance.userSatisfaction * 100).toFixed(1) + '%');
    console.log('- Top Patterns:', insights.topPatterns.length);
    
    // Display improvement areas
    if (insights.improvementAreas.length > 0) {
      console.log('\nAreas for Improvement:');
      insights.improvementAreas.forEach(area => console.log('- ' + area));
    }
  } catch (error) {
    console.error('Learning system error:', error);
  }
}

/**
 * Example 6: Batch Processing
 */
export async function batchProcessingExample() {
  const requests = [
    {
      id: 'batch_001',
      type: 'completion' as const,
      input: 'Explain the concept of closures in JavaScript',
      options: { maxTokens: 500 },
      timestamp: new Date()
    },
    {
      id: 'batch_002',
      type: 'completion' as const,
      input: 'What is the difference between let and const?',
      options: { maxTokens: 300 },
      timestamp: new Date()
    },
    {
      id: 'batch_003',
      type: 'embedding' as const,
      input: 'User authentication with JWT tokens',
      timestamp: new Date()
    }
  ];

  try {
    const responses = await aiHub.batchProcess(requests);
    
    console.log('\nBatch Processing Results:');
    responses.forEach(response => {
      console.log(`\nRequest ${response.requestId}:`);
      console.log(`- Provider: ${response.provider}`);
      console.log(`- Latency: ${response.latency}ms`);
      console.log(`- Cost: $${response.usage.cost.toFixed(6)}`);
      
      if (typeof response.result === 'string') {
        console.log(`- Result: ${response.result.substring(0, 100)}...`);
      } else if (Array.isArray(response.result)) {
        console.log(`- Embedding: [${response.result.slice(0, 5).join(', ')}...]`);
      }
    });
  } catch (error) {
    console.error('Batch processing failed:', error);
  }
}

/**
 * Example 7: Health Check and Metrics
 */
export async function healthCheckExample() {
  try {
    // Check provider health
    const health = await aiHub.healthCheck();
    console.log('\nProvider Health Status:');
    Object.entries(health).forEach(([provider, healthy]) => {
      console.log(`- ${provider}: ${healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
    });
    
    // Get system metrics
    const metrics = aiHub.getMetrics();
    console.log('\nSystem Metrics:');
    console.log(`- Total Requests: ${metrics.totalRequests}`);
    console.log(`- Success Rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)}%`);
    console.log(`- Average Latency: ${metrics.averageLatency.toFixed(0)}ms`);
    console.log(`- Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`- Total Cost: $${metrics.costUsage.total.toFixed(4)}`);
    
    // Provider metrics
    console.log('\nProvider Metrics:');
    Object.entries(metrics.providerMetrics).forEach(([provider, providerMetrics]) => {
      console.log(`- ${provider}:`);
      console.log(`  Requests: ${providerMetrics.requests}`);
      console.log(`  Errors: ${providerMetrics.errors}`);
      console.log(`  Status: ${providerMetrics.status}`);
    });
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

/**
 * Example 8: Custom Configuration
 */
export function customConfigurationExample() {
  // Create custom AI hub configuration
  const customConfig = {
    providers: [
      {
        name: 'openai',
        enabled: true,
        apiKey: process.env['OPENAI_API_KEY'],
        models: [
          { name: 'gpt-4', type: 'completion' as const, maxTokens: 4096, costPerToken: 0.00003 },
          { name: 'gpt-3.5-turbo', type: 'completion' as const, maxTokens: 4096, costPerToken: 0.000002 }
        ],
        priority: 1,
        rateLimit: { requestsPerMinute: 100, tokensPerMinute: 50000 }
      },
      {
        name: 'anthropic',
        enabled: true,
        apiKey: process.env['ANTHROPIC_API_KEY'],
        models: [
          { name: 'claude-3-sonnet', type: 'completion' as const, maxTokens: 4096, costPerToken: 0.00003 }
        ],
        priority: 2
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

  // Update configuration
  aiHub.updateConfig(customConfig);
  
  console.log('AI Hub configured with custom settings');
}

// Export all examples
export const examples = {
  analyzeCode: analyzeCodeExample,
  getRecommendations: getRecommendationsExample,
  generateCodeStream: generateCodeStreamExample,
  analyzeProject: analyzeProjectExample,
  learning: learningExample,
  batchProcessing: batchProcessingExample,
  healthCheck: healthCheckExample,
  customConfiguration: customConfigurationExample
};

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('Running AI Integration Examples...\n');
  
  (async () => {
    await analyzeCodeExample();
    await getRecommendationsExample();
    await generateCodeStreamExample();
    await analyzeProjectExample();
    await learningExample();
    await batchProcessingExample();
    await healthCheckExample();
    customConfigurationExample();
  })();
}
