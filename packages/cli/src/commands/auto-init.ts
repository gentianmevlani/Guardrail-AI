/**
 * Auto-Init
 *
 * Lightweight automatic initialization when running scan/ship
 * on a project that hasn't been set up yet.
 * Detects framework, generates minimal config and truth pack.
 * No prompts — just works.
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { detectFramework, formatFrameworkName, getTemplate, mergeWithFrameworkDefaults } from '../init';
import { TruthPackGenerator } from '../truth-pack';
import { withSpinner } from '../ui/spinner';
import { styles } from '../ui';

/**
 * Check if project needs auto-init, and do it if so.
 * Returns true if auto-init ran, false if already initialized.
 */
export async function ensureInitialized(
  projectPath: string,
  options?: { silent?: boolean },
): Promise<boolean> {
  const guardrailrcPath = join(projectPath, '.guardrailrc');

  if (existsSync(guardrailrcPath)) {
    return false; // Already initialized
  }

  const silent = options?.silent ?? false;

  if (!silent) {
    console.log(
      `  ${styles.brightCyan}ℹ${styles.reset} ${styles.dim}First run detected — auto-configuring...${styles.reset}`,
    );
  }

  // Detect framework
  const detection = detectFramework(projectPath);
  const frameworkName = formatFrameworkName(detection.framework);

  if (!silent) {
    console.log(
      `  ${styles.brightGreen}✓${styles.reset} Detected: ${styles.bold}${frameworkName}${styles.reset}`,
    );
  }

  // Generate config
  const template = getTemplate('startup');
  const config = mergeWithFrameworkDefaults(
    template.config,
    detection.framework,
    detection.recommendedScans,
  );

  const rcContent = {
    version: config.version,
    template: 'startup',
    framework: detection.framework,
    checks: detection.recommendedScans,
    output: '.guardrail',
    policy: config.gating,
    scans: config.scans,
  };

  // Ensure .guardrail directory exists
  const guardrailDir = join(projectPath, '.guardrail');
  if (!existsSync(guardrailDir)) {
    mkdirSync(guardrailDir, { recursive: true });
  }

  writeFileSync(guardrailrcPath, JSON.stringify(rcContent, null, 2));

  // Generate truth pack
  try {
    const generator = new TruthPackGenerator(projectPath);
    if (!generator.isFresh()) {
      if (!silent) {
        await withSpinner('Building Truth Pack', async () => {
          await generator.generate();
        }, { silent });
      } else {
        await generator.generate();
      }
    }
  } catch {
    // Truth pack is optional for scanning
  }

  if (!silent) {
    console.log(
      `  ${styles.brightGreen}✓${styles.reset} Created .guardrailrc ${styles.dim}(run ${styles.bold}guardrail init${styles.reset}${styles.dim} to customize)${styles.reset}`,
    );
    console.log('');
  }

  return true;
}
