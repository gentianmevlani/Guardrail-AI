/**
 * Enterprise CLI styling: Unicode detection, box drawing, icons, ANSI styles.
 */

const hasUnicode = () => {
  if (process.env.GUARDRAIL_NO_UNICODE === '1') return false;
  if (process.platform === 'win32') {
    return !!(
      process.env.CI ||
      process.env.WT_SESSION ||
      process.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm' ||
      process.env.TERM === 'xterm-256color' ||
      process.env.TERM === 'alacritty' ||
      (process.env.LANG && process.env.LANG.toLowerCase().includes('utf-8'))
    );
  }
  return process.env.TERM !== 'linux';
};

export const supportsUnicode = hasUnicode();

export const box = supportsUnicode
  ? {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│',
      cross: '┼',
      teeLeft: '├',
      teeRight: '┤',
      teeUp: '┴',
      teeDown: '┬',
      dTopLeft: '╔',
      dTopRight: '╗',
      dBottomLeft: '╚',
      dBottomRight: '╝',
      dHorizontal: '═',
      dVertical: '║',
    }
  : {
      topLeft: '+',
      topRight: '+',
      bottomLeft: '+',
      bottomRight: '+',
      horizontal: '-',
      vertical: '|',
      cross: '+',
      teeLeft: '+',
      teeRight: '+',
      teeUp: '+',
      teeDown: '+',
      dTopLeft: '+',
      dTopRight: '+',
      dBottomLeft: '+',
      dBottomRight: '+',
      dHorizontal: '=',
      dVertical: '|',
    };

export const icons = {
  scan: supportsUnicode ? '🛡️' : '[SCAN]',
  secret: supportsUnicode ? '🔐' : '[LOCK]',
  compliance: supportsUnicode ? '📋' : '[DOC]',
  sbom: supportsUnicode ? '📦' : '[PKG]',
  auth: supportsUnicode ? '🔑' : '[KEY]',
  fix: supportsUnicode ? '🔧' : '[FIX]',
  ship: supportsUnicode ? '🚀' : '[SHIP]',
  reality: supportsUnicode ? '🌐' : '[WEB]',
  autopilot: supportsUnicode ? '🤖' : '[AUTO]',
  smells: supportsUnicode ? '👃' : '[SMELL]',
  success: supportsUnicode ? '✓' : 'OK',
  error: supportsUnicode ? '✗' : 'ERR',
  warning: supportsUnicode ? '⚠' : 'WRN',
  info: supportsUnicode ? 'ℹ' : 'INF',
  bullet: supportsUnicode ? '•' : '-',
  dot: supportsUnicode ? '●' : '*',
  refresh: supportsUnicode ? '⟳' : 'R',
  block: supportsUnicode ? '█' : '#',
  halfBlock: supportsUnicode ? '◐' : 'o',
};

export const styles = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bullet: '•',
};

export const style = {
  title: (s: string) => `${styles.bold}${styles.brightCyan}${s}${styles.reset}`,
  subtitle: (s: string) => `${styles.dim}${styles.cyan}${s}${styles.reset}`,
  success: (s: string) => `${styles.brightGreen}${s}${styles.reset}`,
  error: (s: string) => `${styles.brightRed}${s}${styles.reset}`,
  warning: (s: string) => `${styles.brightYellow}${s}${styles.reset}`,
  info: (s: string) => `${styles.brightBlue}${s}${styles.reset}`,
  muted: (s: string) => `${styles.dim}${s}${styles.reset}`,
  highlight: (s: string) => `${styles.bold}${styles.brightWhite}${s}${styles.reset}`,
  accent: (s: string) => `${styles.magenta}${s}${styles.reset}`,
  badge: (label: string, color: string) => `${color}${styles.bold} ${label} ${styles.reset}`,
};
