/**
 * Guardrail Spinner
 *
 * Branded spinner wrapper with graceful fallback.
 * Respects NO_COLOR, --json, and --plain flags.
 */

import { isNoColor } from './frame';

export interface Spinner {
  start(): Spinner;
  succeed(text?: string): Spinner;
  fail(text?: string): Spinner;
  warn(text?: string): Spinner;
  update(text: string): Spinner;
  stop(): Spinner;
}

/** Silent no-op spinner for JSON/plain output */
function createSilentSpinner(): Spinner {
  const self: Spinner = {
    start: () => self,
    succeed: () => self,
    fail: () => self,
    warn: () => self,
    update: () => self,
    stop: () => self,
  };
  return self;
}

/** Simple text-only spinner for NO_COLOR environments */
function createTextSpinner(text: string): Spinner {
  const self: Spinner = {
    start() {
      process.stdout.write(`  ... ${text}\n`);
      return self;
    },
    succeed(t?: string) {
      process.stdout.write(`  OK  ${t ?? text}\n`);
      return self;
    },
    fail(t?: string) {
      process.stdout.write(`  ERR ${t ?? text}\n`);
      return self;
    },
    warn(t?: string) {
      process.stdout.write(`  WRN ${t ?? text}\n`);
      return self;
    },
    update(t: string) {
      process.stdout.write(`  ... ${t}\n`);
      return self;
    },
    stop() {
      return self;
    },
  };
  return self;
}

// Cache the ora module once loaded
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ora is dynamically imported ESM
let _ora: ((...args: any[]) => any) | null = null;

async function loadOra(): Promise<typeof _ora> {
  if (_ora) return _ora;
  try {
    const mod = await import('ora');
    _ora = mod.default || mod;
    return _ora;
  } catch {
    return null;
  }
}

/**
 * Create a branded Guardrail spinner.
 *
 * Usage:
 *   const spin = await createSpinner('Scanning project...');
 *   spin.start();
 *   // ... do work ...
 *   spin.succeed('Scan complete');
 */
export async function createSpinner(
  text: string,
  options?: { silent?: boolean },
): Promise<Spinner> {
  // Silent mode for --json output
  if (options?.silent) {
    return createSilentSpinner();
  }

  // Text-only for NO_COLOR
  if (isNoColor()) {
    return createTextSpinner(text);
  }

  // Try to load ora
  const ora = await loadOra();
  if (!ora) {
    return createTextSpinner(text);
  }

  const instance = ora({
    text: `  ${text}`,
    color: 'cyan',
    spinner: 'dots',
    indent: 0,
  });

  const self: Spinner = {
    start() {
      instance.start();
      return self;
    },
    succeed(t?: string) {
      instance.succeed(t ? `  ${t}` : undefined);
      return self;
    },
    fail(t?: string) {
      instance.fail(t ? `  ${t}` : undefined);
      return self;
    },
    warn(t?: string) {
      instance.warn(t ? `  ${t}` : undefined);
      return self;
    },
    update(t: string) {
      instance.text = `  ${t}`;
      return self;
    },
    stop() {
      instance.stop();
      return self;
    },
  };

  return self;
}

/**
 * Run an async operation with a spinner.
 *
 * Usage:
 *   const result = await withSpinner('Building Truth Pack...', async (spin) => {
 *     spin.update('Indexing symbols...');
 *     return await buildTruthPack();
 *   });
 */
export async function withSpinner<T>(
  text: string,
  fn: (spinner: Spinner) => Promise<T>,
  options?: { silent?: boolean; successText?: string; failText?: string },
): Promise<T> {
  const spinner = await createSpinner(text, { silent: options?.silent });
  spinner.start();

  try {
    const result = await fn(spinner);
    spinner.succeed(options?.successText);
    return result;
  } catch (error) {
    spinner.fail(options?.failText ?? `${text} — failed`);
    throw error;
  }
}
