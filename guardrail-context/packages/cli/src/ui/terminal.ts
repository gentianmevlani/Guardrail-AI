/**
 * Terminal capability detection
 * Handles TTY, color, unicode, and width detection
 */
import process from "node:process";

export type TerminalCaps = {
  isTTY: boolean;
  color: boolean;
  unicode: boolean;
  width: number;
};

export function getCaps(): TerminalCaps {
  const isTTY = Boolean(process.stdout.isTTY);
  const width = process.stdout.columns ?? 80;

  const color = isTTY && process.env.NO_COLOR !== "1";
  const unicode = isTTY && process.platform !== "win32"
    ? true
    : isTTY; // modern Windows terminals generally handle unicode fine

  return { isTTY, color, unicode, width };
}

export function shouldUseUI(): boolean {
  // Use full UI only when interactive (not CI, not piped)
  return Boolean(process.stdout.isTTY) && process.env.CI !== "true";
}

export function hr(width = 60): string {
  const { unicode } = getCaps();
  const char = unicode ? "─" : "-";
  return char.repeat(Math.max(10, Math.min(width, 120)));
}

export function isCI(): boolean {
  return process.env.CI === "true" || process.env.CI === "1";
}
