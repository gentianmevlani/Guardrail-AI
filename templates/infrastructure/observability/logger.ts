/**
 * Structured Logging with Correlation IDs
 * 
 * Production-ready logging that most projects forget
 */

import pino from 'pino';

// Create logger instance
export const logger = pino({
  base: { service: process.env.SERVICE_NAME || 'my-service' },
  timestamp: pino.stdTimeFunctions.isoTime,
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  // In development, use pretty printing
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }),
});

/**
 * Create child logger with correlation ID
 */
export function createLogger(correlationId: string, additionalContext?: Record<string, any>) {
  return logger.child({
    correlationId,
    ...additionalContext,
  });
}

/**
 * Log levels
 */
export const logLevels = {
  trace: logger.trace.bind(logger),
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  fatal: logger.fatal.bind(logger),
};

export default logger;

