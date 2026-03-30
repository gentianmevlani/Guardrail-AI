import { getEnv } from '@guardrail/core';
import * as os from 'os';
import pino from 'pino';
import { getRequestId } from './lib/request-context';

const env = getEnv();

// Cache hostname once at module load - this is a performance optimization
// since hostname doesn't change during application lifetime
const CACHED_HOSTNAME = os.hostname();

// Create logger configuration
const loggerConfig: pino.LoggerOptions = {
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label: string) => ({ level: label }),
    log: (object: any) => {
      // Add timestamp, service info, and request context
      const requestId = getRequestId();
      return {
        ...object,
        service: 'guardrail-api',
        version: process.env['npm_package_version'] || '1.0.0',
        hostname: CACHED_HOSTNAME,
        pid: process.pid,
        ...(requestId && { requestId }), // Only add requestId if it exists
      };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive information
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.token',
      'res.headers.set-cookie',
      'user.email',
      'userIp'
    ],
    censor: '*****'
  }
};

// In development, use pretty printing
if (env.NODE_ENV === 'development') {
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  };
}

// Create and export the logger
export const logger = pino(loggerConfig);

// Create a child logger with request context
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}

// Create a child logger with user context
export function createUserLogger(userId: string, userEmail?: string) {
  return logger.child({ 
    userId, 
    userEmail: userEmail || 'unknown',
    context: 'user' 
  });
}

// Create a child logger for specific modules
export function createModuleLogger(module: string) {
  return logger.child({ module });
}

// Export default logger
export default logger;
