/**
 * Guardrail Progress Bar
 *
 * Lightweight progress bar using box-drawing characters.
 * No external dependencies — uses ANSI codes already in the project.
 */

import { isNoColor, frameStyles } from './frame';

export interface ProgressBar {
  /** Update progress. Value should be between 0 and total. */
  update(current: number, label?: string): void;
  /** Mark complete */
  done(label?: string): void;
}

const BAR_WIDTH = 24;
const FILLED = '█';
const EMPTY = '░';

/**
 * Create a progress bar that renders in-place.
 *
 * Usage:
 *   const bar = createProgress(10, 'Scanning');
 *   for (let i = 0; i <= 10; i++) {
 *     bar.update(i, `checking file ${i}/10`);
 *   }
 *   bar.done('Scan complete');
 */
export function createProgress(total: number, label: string): ProgressBar {
  const noColor = isNoColor();
  const isTTY = process.stdout.isTTY;
  let lastLine = '';

  function render(current: number, sublabel?: string): void {
    const pct = total > 0 ? Math.min(current / total, 1) : 0;
    const filled = Math.round(pct * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;
    const pctStr = `${Math.round(pct * 100)}%`.padStart(4);

    const bar = FILLED.repeat(filled) + EMPTY.repeat(empty);
    const detail = sublabel ? ` (${sublabel})` : '';

    let line: string;
    if (noColor) {
      line = `  ${label} [${bar}] ${pctStr}${detail}`;
    } else {
      line = `  ${frameStyles.dim}${label}${frameStyles.reset} ${frameStyles.brightCyan}${bar}${frameStyles.reset} ${pctStr}${detail}`;
    }

    if (isTTY) {
      // Clear previous line and rewrite
      if (lastLine) {
        process.stdout.write('\r\x1b[K');
      }
      process.stdout.write(line);
    } else {
      // Non-TTY: just print each update on new line
      if (line !== lastLine) {
        process.stdout.write(line + '\n');
      }
    }
    lastLine = line;
  }

  return {
    update(current: number, sublabel?: string) {
      render(current, sublabel);
    },
    done(doneLabel?: string) {
      if (isTTY && lastLine) {
        process.stdout.write('\r\x1b[K');
      }
      const text = doneLabel ?? `${label} complete`;
      if (noColor) {
        process.stdout.write(`  OK ${text}\n`);
      } else {
        process.stdout.write(
          `  ${frameStyles.brightGreen}✓${frameStyles.reset} ${text}\n`,
        );
      }
    },
  };
}

/**
 * Multi-step progress indicator.
 *
 * Usage:
 *   const steps = createSteps(4);
 *   steps.start('Reality Sniff');
 *   // ... do work ...
 *   steps.complete('Reality Sniff — 42 findings');
 *   steps.start('Verification Engine');
 */
export interface StepTracker {
  start(label: string): void;
  complete(label?: string): void;
  fail(label?: string): void;
  skip(label: string): void;
}

export function createSteps(totalSteps: number): StepTracker {
  const noColor = isNoColor();
  let current = 0;

  function prefix(): string {
    const step = `[${current}/${totalSteps}]`;
    if (noColor) return `  ${step}`;
    return `  ${frameStyles.dim}${step}${frameStyles.reset}`;
  }

  return {
    start(label: string) {
      current++;
      if (noColor) {
        console.log(`${prefix()} ... ${label}`);
      } else {
        console.log(
          `${prefix()} ${frameStyles.brightCyan}›${frameStyles.reset} ${label}`,
        );
      }
    },
    complete(label?: string) {
      if (noColor) {
        if (label) console.log(`${prefix()} OK  ${label}`);
      } else {
        if (label)
          console.log(
            `${prefix()} ${frameStyles.brightGreen}✓${frameStyles.reset} ${label}`,
          );
      }
    },
    fail(label?: string) {
      if (noColor) {
        if (label) console.log(`${prefix()} ERR ${label}`);
      } else {
        if (label)
          console.log(
            `${prefix()} ${frameStyles.brightMagenta}✗${frameStyles.reset} ${label}`,
          );
      }
    },
    skip(label: string) {
      current++;
      if (noColor) {
        console.log(`${prefix()} --- ${label} (skipped)`);
      } else {
        console.log(
          `${prefix()} ${frameStyles.dim}— ${label} (skipped)${frameStyles.reset}`,
        );
      }
    },
  };
}
