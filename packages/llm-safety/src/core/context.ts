import { randomUUID } from 'node:crypto';
import type { GuardrailCategory, GuardrailContext } from './types.js';

export function buildContext(
  partial: Partial<GuardrailContext> & { category: GuardrailCategory }
): GuardrailContext {
  return {
    id: partial.id ?? randomUUID(),
    category: partial.category,
    input: partial.input,
    output: partial.output,
    systemPrompt: partial.systemPrompt,
    conversationHistory: partial.conversationHistory,
    sourceDocuments: partial.sourceDocuments,
    toolCall: partial.toolCall,
    user: partial.user,
    model: partial.model,
    extensions: partial.extensions ?? {},
  };
}
