import { Engine } from '../../core/engine.js';
import type { GuardrailContext, GuardrailResult } from '../../core/types.js';
import { startTimer } from '../../utils/timer.js';
import { mkResult } from '../helpers.js';

/**
 * Conversation boundary enforcer — limits turn count, context length,
 * and blocked topic adherence across a conversation session.
 */
export class ConversationBoundaryEngine extends Engine {
  readonly manifest = {
    id: 'behavioral.conversation-boundary',
    name: 'Conversation boundary',
    category: 'behavioral' as const,
    version: '0.1.0',
    description: 'Enforces conversation turn limits, context size, and topic constraints',
  };

  async analyze(ctx: GuardrailContext): Promise<GuardrailResult> {
    const start = startTimer();
    const history = ctx.conversationHistory ?? [];
    const ext = ctx.extensions ?? {};
    const maxTurns = (ext['maxTurns'] as number | undefined) ?? 100;
    const maxContextChars = (ext['maxContextChars'] as number | undefined) ?? 500_000;
    const blockedTopics = (ext['blockedTopics'] as string[] | undefined) ?? [];

    if (history.length > maxTurns) {
      return mkResult(this.manifest.id, 'behavioral', 'fail',
        `Turn limit exceeded: ${history.length}/${maxTurns}`, start,
        { details: { turnCount: history.length, maxTurns } });
    }

    const totalChars = history.reduce((n, m) => n + m.content.length, 0);
    if (totalChars > maxContextChars) {
      return mkResult(this.manifest.id, 'behavioral', 'warn',
        `Context size ${totalChars} exceeds ${maxContextChars} chars`, start,
        { details: { totalChars, maxContextChars } });
    }

    if (blockedTopics.length > 0) {
      const input = (ctx.input ?? '').toLowerCase();
      const hit = blockedTopics.find(t => input.includes(t.toLowerCase()));
      if (hit) {
        return mkResult(this.manifest.id, 'behavioral', 'fail',
          `Blocked topic detected: "${hit}"`, start, { details: { blockedTopic: hit } });
      }
    }

    return mkResult(this.manifest.id, 'behavioral', 'pass', 'Conversation within boundaries', start);
  }
}
