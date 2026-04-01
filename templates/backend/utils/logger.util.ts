/**
 * Logger Utility
 * 
 * Essential logging that AI agents often miss
 * Structured logging for production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, meta?: any): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
  }

  private log(level: LogLevel, message: string, meta?: any) {
    const entry = this.formatMessage(level, message, meta);
    
    if (this.isDevelopment) {
      const color = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
      }[level];
      const reset = '\x1b[0m';
      console.log(`${color}[${level.toUpperCase()}]${reset} ${message}`, meta || '');
    } else {
      // In production, use structured logging (JSON)
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, meta?: any) {
    if (this.isDevelopment) {
      this.log('debug', message, meta);
    }
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | any, meta?: any) {
    const errorMeta = {
      ...meta,
      ...(error instanceof Error
        ? {
            error: error.message,
            stack: error.stack,
          }
        : { error }),
    };
    this.log('error', message, errorMeta);
  }
}

export const logger = new Logger();

