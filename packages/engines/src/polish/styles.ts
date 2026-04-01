/**
 * Terminal styling constants for polish command output.
 */

export const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

export const icons = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
  check: '✓',
  cross: '✗',
  arrow: '→',
  star: '★',
  sparkle: '✨',
  wrench: '🔧',
  rocket: '🚀',
  shield: '🛡️',
  lightning: '⚡',
  eye: '👁️',
  search: '🔍',
  book: '📖',
  gear: '⚙️',
  server: '🖥️',
  lock: '🔒',
};

export const categoryIcons: Record<string, string> = {
  Frontend: icons.sparkle,
  Backend: icons.server,
  Security: icons.lock,
  Performance: icons.lightning,
  Accessibility: icons.eye,
  SEO: icons.search,
  Configuration: icons.gear,
  Documentation: icons.book,
  Infrastructure: icons.rocket,
  Observability: '📊',
  Resilience: icons.shield,
  Internationalization: '🌍',
  Privacy: '🔐',
};
