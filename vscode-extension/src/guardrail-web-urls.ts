import * as vscode from "vscode";

/** Default when `guardrail.webAppUrl` is unset (matches package.json). */
export const DEFAULT_GUARDRAIL_WEB_APP_URL = "https://guardrailai.dev";

/**
 * Configured Guardrail web app origin (no trailing slash).
 * Reads `guardrail.webAppUrl`; adds `https://` if the value is host-only.
 */
export function getGuardrailWebAppUrl(): string {
  const raw = vscode.workspace
    .getConfiguration("guardrail")
    .get<string>("webAppUrl", DEFAULT_GUARDRAIL_WEB_APP_URL);
  const trimmed =
    raw && raw.trim().length > 0 ? raw.trim() : DEFAULT_GUARDRAIL_WEB_APP_URL;
  const noSlash = trimmed.replace(/\/$/, "");
  if (
    noSlash.startsWith("http://") ||
    noSlash.startsWith("https://")
  ) {
    return noSlash;
  }
  return `https://${noSlash}`;
}

/**
 * Full URL to a path on the web app (e.g. `/docs`, `/pricing`).
 * Use for `openExternal`, webview `openExternal` URLs, and upgrade hints.
 */
export function getGuardrailWebUrl(path: string): string {
  const base = getGuardrailWebAppUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Hostname for short UI copy (footers, subtitles). */
export function getGuardrailWebAppDisplayHost(): string {
  try {
    return new URL(getGuardrailWebAppUrl()).host;
  } catch {
    return new URL(DEFAULT_GUARDRAIL_WEB_APP_URL).host;
  }
}

export type WebDashboardLinkOptions = {
  /** Extra analytics/context token (e.g. `sidebar`, `post-scan`). Default implies `source=vscode` only. */
  context?: string;
  /** Workspace folder name (no paths) for deep-link hints on the web app. */
  workspaceName?: string;
  /** When set (e.g. after `openLocalWebAppFirst` probe), use this origin instead of `guardrail.webAppUrl`. */
  baseOrigin?: string;
};

/**
 * Canonical web app URL for “open dashboard” from the extension: `source=vscode` plus optional workspace/context.
 */
export function buildWebDashboardUrl(options: WebDashboardLinkOptions = {}): string {
  const rawBase = options.baseOrigin?.trim() || getGuardrailWebAppUrl();
  const base = rawBase.replace(/\/$/, "");
  const url = new URL(`${base}/`);
  url.searchParams.set("source", "vscode");
  if (options.context && options.context.length > 0) {
    url.searchParams.set("ctx", options.context);
  }
  if (options.workspaceName && options.workspaceName.length > 0) {
    url.searchParams.set("workspace", options.workspaceName);
  }
  return url.toString();
}
