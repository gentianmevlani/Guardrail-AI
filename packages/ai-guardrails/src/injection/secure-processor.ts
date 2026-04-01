import { ProcessedInput } from '@guardrail/core';
import { promptInjectionDetector } from './detector';

/**
 * Secure Agent Input Processor
 *
 * Processes and validates all AI agent inputs before they reach the agent
 */
export class SecureAgentInputProcessor {
  /**
   * Process and validate agent input
   */
  async processInput(
    agentId: string,
    input: string,
    source: string
  ): Promise<ProcessedInput> {
    // Scan for injection attempts
    const scanResult = await promptInjectionDetector.scan({
      content: input,
      contentType: 'user_input',
      context: {
        source,
        metadata: { agentId },
      },
    });

    // Determine if we should allow, sanitize, or block
    let processed = input;
    let wasSanitized = false;

    switch (scanResult.recommendation.action) {
      case 'block':
        throw new Error(
          `Input blocked due to injection attempt: ${scanResult.recommendation.reason}`
        );

      case 'sanitize':
      case 'review':
        if (scanResult.sanitizedContent) {
          processed = scanResult.sanitizedContent;
          wasSanitized = true;
        }
        break;

      case 'allow':
        // Use original input
        break;
    }

    return {
      original: input,
      processed,
      wasSanitized,
      detections: scanResult.detections,
    };
  }

  /**
   * Batch process multiple inputs
   */
  async processBatch(
    agentId: string,
    inputs: { id: string; content: string; source: string }[]
  ): Promise<Map<string, ProcessedInput>> {
    const results = new Map<string, ProcessedInput>();

    for (const input of inputs) {
      try {
        const processed = await this.processInput(
          agentId,
          input.content,
          input.source
        );
        results.set(input.id, processed);
      } catch (error) {
        results.set(input.id, {
          original: input.content,
          processed: '',
          wasSanitized: false,
          detections: [],
        });
      }
    }

    return results;
  }

  /**
   * Validate that processed input is safe
   */
  async validateProcessedInput(processed: string): Promise<boolean> {
    const scanResult = await promptInjectionDetector.scan({
      content: processed,
      contentType: 'user_input',
    });

    return scanResult.verdict === 'CLEAN';
  }
}

// Export singleton instance
export const secureInputProcessor = new SecureAgentInputProcessor();
