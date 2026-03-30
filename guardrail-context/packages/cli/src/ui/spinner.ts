/**
 * Spinner/Progress UI components
 * Loading states and step indicators
 */
import ora, { type Ora } from "ora";
import { shouldUseUI, getCaps } from "./terminal.js";
import chalk from "chalk";

export function spin(text: string): Ora {
  if (!shouldUseUI()) {
    // Fallback no-op spinner for non-TTY
    const fake: any = {
      start: () => fake,
      stop: () => fake,
      succeed: (t?: string) => { if (t) console.log(`✓ ${t}`); return fake; },
      fail: (t?: string) => { if (t) console.error(`✗ ${t}`); return fake; },
      info: (t?: string) => { if (t) console.log(`ℹ ${t}`); return fake; },
      warn: (t?: string) => { if (t) console.warn(`⚠ ${t}`); return fake; },
      text
    };
    return fake as Ora;
  }
  return ora({ text, spinner: "dots" }).start();
}

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface Step {
  label: string;
  status: StepStatus;
  detail?: string;
}

export function renderSteps(steps: Step[]): string {
  const { color, unicode } = getCaps();
  const lines: string[] = [];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const num = `[${i + 1}/${steps.length}]`;
    
    const icon = (() => {
      if (!unicode) {
        switch (step.status) {
          case "done": return "[OK]";
          case "failed": return "[X]";
          case "running": return "[..]";
          case "skipped": return "[-]";
          default: return "[ ]";
        }
      }
      switch (step.status) {
        case "done": return "✅";
        case "failed": return "❌";
        case "running": return "⏳";
        case "skipped": return "⏭️";
        default: return "○";
      }
    })();
    
    const label = (() => {
      if (!color) return step.label;
      switch (step.status) {
        case "done": return chalk.green(step.label);
        case "failed": return chalk.red(step.label);
        case "running": return chalk.yellow(step.label);
        case "skipped": return chalk.dim(step.label);
        default: return chalk.dim(step.label);
      }
    })();
    
    const detail = step.detail ? (color ? chalk.dim(` ${step.detail}`) : ` ${step.detail}`) : "";
    
    lines.push(`${num} ${icon} ${label}${detail}`);
  }
  
  return lines.join("\n");
}

export function progressBar(current: number, total: number, width = 30): string {
  const { unicode } = getCaps();
  const pct = Math.min(1, current / total);
  const filled = Math.round(pct * width);
  const empty = width - filled;
  
  const filledChar = unicode ? "█" : "#";
  const emptyChar = unicode ? "░" : "-";
  
  return `[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}] ${Math.round(pct * 100)}%`;
}
