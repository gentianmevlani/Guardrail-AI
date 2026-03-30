/**
 * AI Explainer Service
 * 
 * Real AI integration for code explanation using OpenAI or Anthropic.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface ExplanationOptions {
  experienceLevel?: 'beginner' | 'intermediate' | 'expert';
  provider?: 'openai' | 'anthropic';
}

export interface CodeExplanation {
  summary: string;
  details: string[];
  complexity: string;
  edgeCases: string[];
  improvements: string[];
  provider: string;
  timestamp: string;
}

export interface QuestionOptions {
  provider?: 'openai' | 'anthropic';
}

export interface QuestionAnswer {
  answer: string;
  confidence: number;
  suggestions: string[];
  provider: string;
  timestamp: string;
}

class AIExplainer {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Initialize Anthropic if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  /**
   * Explain code using AI
   */
  async explainCode(code: string, options: ExplanationOptions = {}): Promise<CodeExplanation> {
    const { experienceLevel = 'intermediate', provider = 'openai' } = options;

    // Build the prompt based on experience level
    const prompt = this.buildExplanationPrompt(code, experienceLevel);

    // Try to use the requested provider
    if (provider === 'anthropic' && this.anthropic) {
      return this.explainWithAnthropic(code, prompt, experienceLevel);
    }

    if (provider === 'openai' && this.openai) {
      return this.explainWithOpenAI(code, prompt, experienceLevel);
    }

    // Fallback: try any available provider
    if (this.openai) {
      return this.explainWithOpenAI(code, prompt, experienceLevel);
    }

    if (this.anthropic) {
      return this.explainWithAnthropic(code, prompt, experienceLevel);
    }

    // No AI provider available - return a basic analysis
    return this.basicCodeAnalysis(code, experienceLevel);
  }

  /**
   * Ask a question about code using AI
   */
  async askQuestion(code: string, question: string, options: QuestionOptions = {}): Promise<QuestionAnswer> {
    const { provider = 'openai' } = options;

    const prompt = this.buildQuestionPrompt(code, question);

    // Try to use the requested provider
    if (provider === 'anthropic' && this.anthropic) {
      return this.askWithAnthropic(prompt);
    }

    if (provider === 'openai' && this.openai) {
      return this.askWithOpenAI(prompt);
    }

    // Fallback: try any available provider
    if (this.openai) {
      return this.askWithOpenAI(prompt);
    }

    if (this.anthropic) {
      return this.askWithAnthropic(prompt);
    }

    // No AI provider available
    return {
      answer: 'AI service is not available. Please configure OPENAI_API_KEY or ANTHROPIC_API_KEY.',
      confidence: 0,
      suggestions: ['Configure an AI provider in your environment'],
      provider: 'none',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Explain code using OpenAI
   */
  private async explainWithOpenAI(code: string, prompt: string, level: string): Promise<CodeExplanation> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert code explainer. Explain code clearly based on the user's experience level.
            Respond with a JSON object containing:
            - summary: A brief summary of what the code does
            - details: An array of bullet points explaining the code step by step
            - complexity: The complexity level (simple/intermediate/complex)
            - edgeCases: An array of potential edge cases to consider
            - improvements: An array of suggested improvements`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);

      return {
        summary: parsed.summary || 'Unable to generate summary',
        details: parsed.details || [],
        complexity: parsed.complexity || level,
        edgeCases: parsed.edgeCases || [],
        improvements: parsed.improvements || [],
        provider: 'openai',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('OpenAI explanation error:', error);
      // Fall back to basic analysis
      return this.basicCodeAnalysis(code, level);
    }
  }

  /**
   * Explain code using Anthropic
   */
  private async explainWithAnthropic(code: string, prompt: string, level: string): Promise<CodeExplanation> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    try {
      const response = await this.anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: `${prompt}
            
Please respond with a JSON object containing:
- summary: A brief summary of what the code does
- details: An array of bullet points explaining the code step by step
- complexity: The complexity level (simple/intermediate/complex)
- edgeCases: An array of potential edge cases to consider
- improvements: An array of suggested improvements

Response (JSON only):`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from Anthropic response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        summary: parsed.summary || 'Unable to generate summary',
        details: parsed.details || [],
        complexity: parsed.complexity || level,
        edgeCases: parsed.edgeCases || [],
        improvements: parsed.improvements || [],
        provider: 'anthropic',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Anthropic explanation error:', error);
      // Fall back to basic analysis
      return this.basicCodeAnalysis(code, level);
    }
  }

  /**
   * Ask a question using OpenAI
   */
  private async askWithOpenAI(prompt: string): Promise<QuestionAnswer> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert code analyst. Answer questions about code clearly and concisely.
            Respond with a JSON object containing:
            - answer: Your answer to the question
            - confidence: A number between 0 and 1 indicating your confidence
            - suggestions: An array of follow-up questions the user might want to ask`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);

      return {
        answer: parsed.answer || 'Unable to generate answer',
        confidence: parsed.confidence || 0.5,
        suggestions: parsed.suggestions || [],
        provider: 'openai',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('OpenAI question error:', error);
      return {
        answer: 'Sorry, I encountered an error processing your question.',
        confidence: 0,
        suggestions: ['Try asking a different question', 'Check the code syntax'],
        provider: 'openai',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Ask a question using Anthropic
   */
  private async askWithAnthropic(prompt: string): Promise<QuestionAnswer> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    try {
      const response = await this.anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `${prompt}

Please respond with a JSON object containing:
- answer: Your answer to the question
- confidence: A number between 0 and 1 indicating your confidence
- suggestions: An array of follow-up questions the user might want to ask

Response (JSON only):`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from Anthropic response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        answer: parsed.answer || 'Unable to generate answer',
        confidence: parsed.confidence || 0.5,
        suggestions: parsed.suggestions || [],
        provider: 'anthropic',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Anthropic question error:', error);
      return {
        answer: 'Sorry, I encountered an error processing your question.',
        confidence: 0,
        suggestions: ['Try asking a different question', 'Check the code syntax'],
        provider: 'anthropic',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Build explanation prompt based on experience level
   */
  private buildExplanationPrompt(code: string, level: string): string {
    const levelInstructions = {
      beginner: 'Explain this code as if teaching someone who is new to programming. Use simple language, avoid jargon, and explain every concept.',
      intermediate: 'Explain this code for someone with programming experience. Focus on the logic and patterns used.',
      expert: 'Provide a concise, technical explanation focusing on implementation details, performance considerations, and best practices.',
    };

    return `${levelInstructions[level as keyof typeof levelInstructions] || levelInstructions.intermediate}

Code to explain:
\`\`\`
${code}
\`\`\``;
  }

  /**
   * Build question prompt
   */
  private buildQuestionPrompt(code: string, question: string): string {
    return `Given the following code:

\`\`\`
${code}
\`\`\`

Question: ${question}`;
  }

  /**
   * Basic code analysis when no AI provider is available
   */
  private basicCodeAnalysis(code: string, level: string): CodeExplanation {
    const lines = code.split('\n');
    const functions = code.match(/function\s+\w+|const\s+\w+\s*=/g) || [];
    const classes = code.match(/class\s+\w+/g) || [];
    const imports = code.match(/import.*from/g) || [];
    const hasAsync = code.includes('async') || code.includes('await');
    const hasLoops = /for\s*\(|while\s*\(/.test(code);
    const hasConditionals = /if\s*\(|switch\s*\(/.test(code);
    
    // Count control flow statements for complexity
    const controlFlowCount = (code.match(/\b(if|else|for|while|switch|case|catch)\b/g) || []).length;

    const details: string[] = [];
    
    if (imports.length > 0) {
      details.push(`Imports ${imports.length} module(s)`);
    }
    if (classes.length > 0) {
      details.push(`Defines ${classes.length} class(es)`);
    }
    if (functions.length > 0) {
      details.push(`Contains ${functions.length} function(s)/variable(s)`);
    }
    if (hasAsync) {
      details.push('Uses asynchronous operations (async/await)');
    }
    if (hasLoops) {
      details.push('Contains loops for iteration');
    }
    if (hasConditionals) {
      details.push('Uses conditional logic (if/switch)');
    }

    // Improved complexity calculation
    const complexity = 
      lines.length > 50 || functions.length > 5 || controlFlowCount > 10 ? 'complex' : 
      lines.length > 20 || functions.length > 2 || controlFlowCount > 5 ? 'intermediate' : 'simple';

    return {
      summary: `This code contains ${lines.length} lines with ${functions.length} function(s) and ${classes.length} class(es).`,
      details,
      complexity,
      edgeCases: [
        'Consider handling null/undefined inputs',
        'Check for empty arrays or collections',
        'Handle potential async errors',
      ],
      improvements: [
        'Add input validation',
        'Consider adding error handling',
        'Add JSDoc comments for better documentation',
      ],
      provider: 'basic',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if AI is available
   */
  isAvailable(): boolean {
    return this.openai !== null || this.anthropic !== null;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.openai) providers.push('openai');
    if (this.anthropic) providers.push('anthropic');
    return providers;
  }
}

export const aiExplainer = new AIExplainer();
