/**
 * Shared CLI UI utilities for consistent header rendering across commands.
 * 
 * Provides ANSI-safe width calculation and respects NO_COLOR environment variable.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ANSI UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

const ANSI_RE = /\x1b\[[0-9;]*m/g;

/**
 * Strip ANSI escape codes from a string for accurate width calculation.
 */
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

/**
 * Pad string to width, accounting for ANSI codes.
 */
export function padRight(s: string, width: number): string {
  const len = stripAnsi(s).length;
  if (len >= width) return s;
  return s + ' '.repeat(width - len);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR SUPPORT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if colors should be disabled (respects NO_COLOR and --no-color).
 */
export function isNoColor(): boolean {
  return !!(
    process.env.NO_COLOR ||
    process.env.GUARDRAIL_NO_COLOR === '1' ||
    process.argv.includes('--no-color')
  );
}

/**
 * Conditionally apply ANSI style codes based on NO_COLOR setting.
 */
function applyStyle(code: string): string {
  return isNoColor() ? '' : code;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const frameStyles = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  brightCyan: '\x1b[96m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightMagenta: '\x1b[95m',
};

function getStyle(key: keyof typeof frameStyles): string {
  return applyStyle(frameStyles[key]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRAME RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

export interface FrameOptions {
  padding?: number;
  title?: string;
}

/**
 * Render lines inside a styled frame with ANSI-safe width calculation.
 */
export function frameLines(lines: string[], opts?: FrameOptions): string[] {
  const padding = opts?.padding ?? 1;
  const noColor = isNoColor();

  // Compute inner width based on visible length (ANSI stripped)
  const innerWidth = Math.max(
    ...lines.map((l) => stripAnsi(l).length),
    ...(opts?.title ? [stripAnsi(opts.title).length] : [0])
  );

  const contentWidth = innerWidth + padding * 2;

  const borderStyle = noColor ? '' : `${frameStyles.brightCyan}${frameStyles.bold}`;
  const reset = noColor ? '' : frameStyles.reset;

  const top = `${borderStyle}╔${'═'.repeat(contentWidth + 2)}╗${reset}`;
  const bottom = `${borderStyle}╚${'═'.repeat(contentWidth + 2)}╝${reset}`;

  const framed: string[] = [];
  framed.push(top);

  // Optional title row
  if (opts?.title) {
    const title = padRight(opts.title, innerWidth);
    framed.push(`${borderStyle}║${reset} ${' '.repeat(padding)}${title}${' '.repeat(padding)} ${borderStyle}║${reset}`);
    framed.push(`${borderStyle}║${reset} ${' '.repeat(contentWidth)} ${borderStyle}║${reset}`);
  }

  for (const line of lines) {
    const padded = padRight(line, innerWidth);
    framed.push(`${borderStyle}║${reset} ${' '.repeat(padding)}${padded}${' '.repeat(padding)} ${borderStyle}║${reset}`);
  }

  framed.push(bottom);
  return framed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND HEADER RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

export interface CommandHeaderOptions {
  /** Command title (e.g., "CODE SMELL ANALYSIS") */
  title: string;
  /** Icon to display before title */
  icon: string;
  /** Project name */
  projectName: string;
  /** Project path */
  projectPath: string;
  /** Additional metadata lines (key-value pairs) */
  metadata?: Array<{ key: string; value: string }>;
  /** User tier (free/starter/pro/enterprise) */
  tier?: string;
  /** Whether user is authenticated */
  authenticated?: boolean;
}

/**
 * Truncate path for display, keeping end portion visible.
 */
export function truncatePath(path: string, maxLength = 60): string {
  if (path.length <= maxLength) return path;
  const start = path.substring(0, 15);
  const end = path.substring(path.length - (maxLength - 18));
  return `${start}...${end}`;
}

/**
 * Format tier badge for display.
 */
function formatTierBadge(tier: string): string {
  const noColor = isNoColor();
  const tierUpper = tier.toUpperCase();
  
  if (noColor) {
    return `[${tierUpper}]`;
  }
  
  const colors: Record<string, string> = {
    free: frameStyles.dim,
    starter: frameStyles.brightGreen,
    pro: frameStyles.brightMagenta,
    enterprise: frameStyles.brightCyan,
  };
  
  const color = colors[tier.toLowerCase()] || frameStyles.dim;
  return `${color}${frameStyles.bold}[${tierUpper}]${frameStyles.reset}`;
}

/**
 * Render a consistent command header frame with project metadata.
 * 
 * Used by scan, ship, smells, and other commands for visual consistency.
 */
export function renderCommandHeader(opts: CommandHeaderOptions): string {
  const noColor = isNoColor();
  const reset = noColor ? '' : frameStyles.reset;
  const bold = noColor ? '' : frameStyles.bold;
  const dim = noColor ? '' : frameStyles.dim;
  const brightCyan = noColor ? '' : frameStyles.brightCyan;
  
  const headerLines: string[] = [];
  
  // Title line with icon
  headerLines.push(`${brightCyan}${bold}${opts.icon} ${opts.title}${reset}`);
  headerLines.push('');
  
  // Project info
  headerLines.push(`${dim}Project:${reset}     ${bold}${opts.projectName}${reset}`);
  headerLines.push(`${dim}Path:${reset}        ${truncatePath(opts.projectPath)}`);
  
  // Additional metadata
  if (opts.metadata) {
    for (const { key, value } of opts.metadata) {
      const paddedKey = key.padEnd(10);
      headerLines.push(`${dim}${paddedKey}:${reset} ${value}`);
    }
  }
  
  // Started timestamp
  headerLines.push(`${dim}Started:${reset}     ${new Date().toLocaleString()}`);
  
  // Tier badge if authenticated
  if (opts.authenticated && opts.tier) {
    headerLines.push(`${dim}Mode:${reset}        ${formatTierBadge(opts.tier)}`);
  }
  
  const framed = frameLines(headerLines, { padding: 2 });
  return framed.join('\n');
}

/**
 * Print command header to console with surrounding newlines.
 */
export function printCommandHeader(opts: CommandHeaderOptions): void {
  console.log('');
  console.log(renderCommandHeader(opts));
  console.log('');
}
