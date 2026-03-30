export const logger = {
  error: (...args: any[]) => {
    console.error(...args);
  },
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  info: (...args: any[]) => {
    console.info(...args);
  },
  debug: (...args: any[]) => {
    console.debug(...args);
  },
};
