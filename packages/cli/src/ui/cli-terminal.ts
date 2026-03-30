import { icons, styles, supportsUnicode } from './cli-styles';

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
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

export const c = {
  critical: (t: string) => `${colors.bgRed}${colors.white}${colors.bold} ${t} ${colors.reset}`,
  high: (t: string) => `${colors.red}${colors.bold}${t}${colors.reset}`,
  medium: (t: string) => `${colors.yellow}${t}${colors.reset}`,
  low: (t: string) => `${colors.blue}${t}${colors.reset}`,
  success: (t: string) => `${colors.green}${t}${colors.reset}`,
  info: (t: string) => `${colors.cyan}${t}${colors.reset}`,
  bold: (t: string) => `${colors.bold}${t}${colors.reset}`,
  dim: (t: string) => `${colors.dim}${t}${colors.reset}`,
  header: (t: string) => `${colors.bold}${colors.cyan}${t}${colors.reset}`,
};

const logo = `
${colors.cyan}${colors.bold}   ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ ██████╗  █████╗ ██╗██╗     
  ██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║██║     
  ██║  ███╗██║   ██║███████║██████╔╝██║  ██║██████╔╝███████║██║██║     
  ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║██╔══██╗██╔══██║██║██║     
  ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝██║  ██║██║  ██║██║███████╗
   ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝${colors.reset}
                     ${colors.dim}AI-Native Code Security Platform${colors.reset}
`;

export function printLogo(): void {
  console.log(logo);
}

export function spinner(text: string): { stop: (success?: boolean, message?: string) => void } {
  const frames = supportsUnicode
    ? ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    : ['-', '\\', '|', '/'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${styles.brightCyan}${frames[i]}${styles.reset} ${text}`);
    i = (i + 1) % frames.length;
  }, 80);

  return {
    stop: (success = true, message?: string) => {
      clearInterval(interval);
      const icon = success
        ? `${styles.brightGreen}${icons.success}${styles.reset}`
        : `${styles.brightRed}${icons.error}${styles.reset}`;
      process.stdout.write(`\r${icon} ${message || text}                    \n`);
    },
  };
}
