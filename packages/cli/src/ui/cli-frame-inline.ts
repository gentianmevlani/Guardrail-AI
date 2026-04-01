import { icons, styles, supportsUnicode } from './cli-styles';

const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

export function padRight(s: string, width: number): string {
  const len = stripAnsi(s).length;
  if (len >= width) return s;
  return s + ' '.repeat(width - len);
}

export function frameLines(lines: string[], opts?: { padding?: number; title?: string }): string[] {
  const padding = opts?.padding ?? 1;

  const innerWidth = Math.max(
    ...lines.map((l) => stripAnsi(l).length),
    ...(opts?.title ? [stripAnsi(opts.title).length] : [0])
  );

  const contentWidth = innerWidth + padding * 2;

  const top = `${styles.brightCyan}${styles.bold}╔${'═'.repeat(contentWidth + 2)}╗${styles.reset}`;
  const bottom = `${styles.brightCyan}${styles.bold}╚${'═'.repeat(contentWidth + 2)}╝${styles.reset}`;

  const framed: string[] = [];
  framed.push(top);

  if (opts?.title) {
    const title = padRight(opts.title, innerWidth);
    framed.push(`${styles.brightCyan}${styles.bold}║${styles.reset} ${' '.repeat(padding)}${title}${' '.repeat(padding)} ${styles.brightCyan}${styles.bold}║${styles.reset}`);
    framed.push(`${styles.brightCyan}${styles.bold}║${styles.reset} ${' '.repeat(contentWidth)} ${styles.brightCyan}${styles.bold}║${styles.reset}`);
  }

  for (const line of lines) {
    const padded = padRight(line, innerWidth);
    framed.push(`${styles.brightCyan}${styles.bold}║${styles.reset} ${' '.repeat(padding)}${padded}${' '.repeat(padding)} ${styles.brightCyan}${styles.bold}║${styles.reset}`);
  }

  framed.push(bottom);
  return framed;
}

export function renderGuardrailBanner(params: { subtitle?: string; authLine?: string }): string {
  const subtitle =
    params.subtitle ??
    `${styles.brightMagenta}${styles.bold}${icons.refresh} AI-Native Code Security Platform ${icons.refresh}${styles.reset}`;

  const art = supportsUnicode
    ? [
        `${styles.brightWhite}${styles.bold}  ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ ██████╗  █████╗ ██╗██╗     ${styles.reset}`,
        `${styles.brightWhite}${styles.bold} ██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║██║     ${styles.reset}`,
        `${styles.brightWhite}${styles.bold} ██║  ███╗██║   ██║███████║██████╔╝██║  ██║██████╔╝███████║██║██║     ${styles.reset}`,
        `${styles.brightWhite}${styles.bold} ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║██╔══██╗██╔══██║██║██║     ${styles.reset}`,
        `${styles.brightWhite}${styles.bold} ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝██║  ██║██║  ██║██║███████╗${styles.reset}`,
        `${styles.brightWhite}${styles.bold}  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝${styles.reset}`,
        '',
        `${styles.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${styles.reset}`,
        `                    ${subtitle}`,
        `${styles.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${styles.reset}`,
      ]
    : [
        '  _____ _    _  _   ____  _____  _____   _   ___ _      ',
        ' / ____| |  | |/ \\ |  _ \\|  __ \\|  __ \\ / \\ |_ _| |     ',
        '| |  __| |  | / _ \\| |_) | |__) | |__) / _ \\ | || |     ',
        '| | |_ | |  |/ ___ \\  _ <|  _  /|  _  / ___ \\| || |     ',
        '| |__| | |__| /   \\ | |_) | | \\ \\| | \\ / ___ \\| || |____ ',
        ' \\_____|\\____/_/   \\_\\____/|_|  \\_\\_|  \\_/_/   \\_\\______|',
        '',
        '----------------------------------------------------------------------',
        `                    ${subtitle}`,
        '----------------------------------------------------------------------',
      ];

  const framed = frameLines(art, { padding: 2 });
  const block = framed.join('\n');

  return params.authLine ? `${block}\n\n${params.authLine}\n` : `${block}\n`;
}

export function truncatePath(path: string, maxLength = 60): string {
  if (path.length <= maxLength) return path;

  const normalizedPath = path.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');

  if (parts.length < 3) {
    return path.substring(0, maxLength - 3) + '...';
  }

  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  const mid = '...';

  const available = maxLength - first.length - last.length - 2;
  if (available < 5) {
    return (first + '/.../' + last).substring(0, maxLength);
  }

  return `${first}/${mid}/${last}`;
}
