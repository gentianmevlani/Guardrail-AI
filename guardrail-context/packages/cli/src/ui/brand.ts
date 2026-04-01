/**
 * Brand elements - logo, colors, badges
 * Consistent visual identity across all commands
 */
import chalk from "chalk";
import { getCaps } from "./terminal.js";

export function brandTitle(): string {
  const { color, unicode } = getCaps();
  const shield = unicode ? "🛡️" : "[GR]";
  const name = color ? chalk.bold.cyan("guardrail") : "guardrail";
  return `${shield} ${name}`;
}

export function brandHeader(subtitle?: string): string {
  const { color, unicode } = getCaps();
  const shield = unicode ? "🛡️" : "[GR]";
  const name = color ? chalk.bold.cyan("guardrail") : "guardrail";
  const sub = subtitle ? (color ? chalk.dim(` — ${subtitle}`) : ` — ${subtitle}`) : "";
  return `${shield} ${name}${sub}`;
}

export type BadgeKind = "ok" | "warn" | "bad" | "info" | "lock" | "pro";

export function badge(text: string, kind: BadgeKind = "info"): string {
  const { color, unicode } = getCaps();
  
  const icon = (() => {
    if (!unicode) return "";
    switch (kind) {
      case "ok": return "✅ ";
      case "warn": return "⚠️ ";
      case "bad": return "🚫 ";
      case "lock": return "🔒 ";
      case "pro": return "⭐ ";
      default: return "ℹ️ ";
    }
  })();

  if (!color) return `${icon}${text}`;
  
  const colorFn = (() => {
    switch (kind) {
      case "ok": return chalk.green;
      case "warn": return chalk.yellow;
      case "bad": return chalk.red;
      case "lock": return chalk.magenta;
      case "pro": return chalk.cyan.bold;
      default: return chalk.cyan;
    }
  })();
  
  return colorFn(`${icon}${text}`);
}

export function verdict(type: "GO" | "WARN" | "NO-GO"): string {
  const { color, unicode } = getCaps();
  
  const icons = {
    "GO": unicode ? "✅" : "[OK]",
    "WARN": unicode ? "⚠️" : "[!]",
    "NO-GO": unicode ? "🚫" : "[X]",
  };
  
  const text = `${icons[type]} ${type}`;
  
  if (!color) return text;
  
  switch (type) {
    case "GO": return chalk.bgGreen.white.bold(` ${text} `);
    case "WARN": return chalk.bgYellow.black.bold(` ${text} `);
    case "NO-GO": return chalk.bgRed.white.bold(` ${text} `);
  }
}

export function dim(text: string): string {
  const { color } = getCaps();
  return color ? chalk.dim(text) : text;
}

export function bold(text: string): string {
  const { color } = getCaps();
  return color ? chalk.bold(text) : text;
}

export function link(url: string): string {
  const { color } = getCaps();
  return color ? chalk.cyan.underline(url) : url;
}

export function success(text: string): string {
  const { color } = getCaps();
  return color ? chalk.green(text) : text;
}

export function warning(text: string): string {
  const { color } = getCaps();
  return color ? chalk.yellow(text) : text;
}

export function error(text: string): string {
  const { color } = getCaps();
  return color ? chalk.red(text) : text;
}
