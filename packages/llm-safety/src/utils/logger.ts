import pino from 'pino';

export function createLogger(name = 'llm-guardrail') {
  return pino({ name, level: process.env['LOG_LEVEL'] ?? 'info' });
}
