/**
 * Box/Panel UI components
 * Consistent panel layouts across all commands
 */
import boxen from "boxen";
import chalk from "chalk";
import { getCaps } from "./terminal.js";

export type PanelKind = "neutral" | "ok" | "warn" | "bad" | "info";

export function panel(title: string, body: string, opts?: { kind?: PanelKind }): string {
  const { color, width } = getCaps();
  const kind = opts?.kind ?? "neutral";

  const borderColor = (() => {
    if (!color) return "white";
    switch (kind) {
      case "ok": return "green";
      case "warn": return "yellow";
      case "bad": return "red";
      case "info": return "cyan";
      default: return "cyan";
    }
  })() as "green" | "yellow" | "red" | "cyan" | "white";

  const header = color ? chalk.bold(title) : title;

  return boxen(`${header}\n\n${body}`, {
    padding: 1,
    margin: 0,
    borderStyle: "round",
    borderColor,
    width: Math.min(width - 4, 100),
  });
}

export function simpleBox(content: string, opts?: { padding?: number; borderColor?: string }): string {
  const { width } = getCaps();
  
  return boxen(content, {
    padding: opts?.padding ?? 1,
    margin: 0,
    borderStyle: "round",
    borderColor: (opts?.borderColor ?? "cyan") as any,
    width: Math.min(width - 4, 100),
  });
}

export function divider(width = 60): string {
  const { unicode } = getCaps();
  const char = unicode ? "─" : "-";
  return char.repeat(Math.max(10, Math.min(width, 100)));
}

export function section(title: string): string {
  const { color, unicode } = getCaps();
  const prefix = unicode ? "▸" : ">";
  const text = `${prefix} ${title}`;
  return color ? chalk.bold.cyan(text) : text;
}
