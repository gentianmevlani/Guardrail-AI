/**
 * Simple logger for demo purposes
 */
export const logger = {
  info: (message: string, meta?: object) => console.log(`[INFO] ${message}`, meta || ''),
  error: (message: string, error?: unknown) => console.error(`[ERROR] ${message}`, error || ''),
  warn: (message: string, meta?: object) => console.warn(`[WARN] ${message}`, meta || ''),
  debug: (message: string, meta?: object) => console.debug(`[DEBUG] ${message}`, meta || ''),
};
