import { loadConfig } from '../runtime/cli-config';
import { icons, styles } from './cli-styles';
import { renderGuardrailBanner } from './cli-frame-inline';

export function printMenuHeader(): void {
  console.clear();
  console.log('');

  const cfg = loadConfig();

  let authLine: string;
  if (cfg.apiKey) {
    const tierBadge =
      cfg.tier === 'enterprise'
        ? `${styles.bgBlue}${styles.white}${styles.bold} ENTERPRISE ${styles.reset}`
        : cfg.tier === 'pro'
          ? `${styles.bgMagenta}${styles.white}${styles.bold} PRO ${styles.reset}`
          : cfg.tier === 'starter'
            ? `${styles.brightGreen}${styles.bold} STARTER ${styles.reset}`
            : `${styles.dim} FREE ${styles.reset}`;
    const email = cfg.email || 'authenticated';
    authLine = `  ${styles.brightGreen}${icons.dot}${styles.reset} Authenticated as ${styles.bold}${email}${styles.reset}  ${tierBadge}`;
  } else {
    authLine = `  ${styles.brightRed}${icons.dot}${styles.reset} Not authenticated ${styles.dim}(select Auth to login)${styles.reset}`;
  }

  console.log(renderGuardrailBanner({ authLine }));
}

export function printDivider(char = '─', width = 60): void {
  console.log(`  ${styles.dim}${char.repeat(width)}${styles.reset}`);
}

export function printStatusBadge(
  status: 'authenticated' | 'unauthenticated' | 'pro' | 'enterprise' | 'starter' | 'free'
): void {
  const badges: Record<string, string> = {
    authenticated: `${styles.bgCyan}${styles.black}${styles.bold} ✓ AUTHENTICATED ${styles.reset}`,
    unauthenticated: `${styles.brightRed}${styles.bold} ✗ NOT AUTHENTICATED ${styles.reset}`,
    pro: `${styles.bgMagenta}${styles.white}${styles.bold} PRO ${styles.reset}`,
    enterprise: `${styles.bgBlue}${styles.white}${styles.bold} ENTERPRISE ${styles.reset}`,
    starter: `${styles.brightGreen}${styles.bold} STARTER ${styles.reset}`,
    free: `${styles.dim} FREE ${styles.reset}`,
  };
  console.log(`  ${badges[status] || badges.free}`);
}
