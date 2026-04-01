/**
 * Anthropic Service
 * 
 * Handles Anthropic Claude API calls for advanced code analysis
 */

import Anthropic from '@anthropic-ai/sdk';

export interface ClaudeOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

class AnthropicService {
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({
        apiKey,
      });
    }
  }

  /**
   * Analyze code with Claude
   */
  async analyzeCode(
    code: string,
    prompt: string,
    options: ClaudeOptions = {}
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Anthropic API key not configured');
    }

    const model = options.model || process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229';
    const temperature = options.temperature || 0.3;
    const maxTokens = options.maxTokens || 4000;

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nCode:\n\`\`\`\n${code}\n\`\`\``,
        },
      ],
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  /**
   * Get code suggestions
   */
  async getSuggestions(
    code: string,
    context: string
  ): Promise<string[]> {
    const prompt = `Analyze this code and provide 3-5 improvement suggestions. Context: ${context}`;
    const analysis = await this.analyzeCode(code, prompt);
    
    // Parse suggestions from response
    const suggestions = analysis
      .split('\n')
      .filter(line => line.match(/^\d+\.|^[-*]/))
      .map(line => line.replace(/^\d+\.|^[-*]\s*/, '').trim())
      .filter(Boolean);

    return suggestions;
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }
}

export const anthropicService = new AnthropicService();

