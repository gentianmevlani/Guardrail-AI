/**
 * Scan History — Persists scan results over time for trend visualization.
 *
 * Stores the last 30 scan snapshots in workspace state. The Hub displays
 * these as a sparkline/area chart showing score trajectory.
 */

import * as vscode from "vscode";

const STORAGE_KEY = "guardrail.scanHistory";
const MAX_ENTRIES = 30;

export interface ScanHistoryEntry {
  score: number;
  grade: string;
  canShip: boolean;
  findingCount: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  timestamp: string;
}

export interface ScanHistoryData {
  entries: ScanHistoryEntry[];
  trend: "improving" | "stable" | "declining";
  delta: number; // Score change from previous scan
  bestScore: number;
  worstScore: number;
  averageScore: number;
}

let workspaceState: vscode.Memento | null = null;
let history: ScanHistoryEntry[] = [];

export function registerScanHistoryMemento(memento: vscode.Memento): void {
  workspaceState = memento;
  const raw = memento.get<string>(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        history = parsed.slice(-MAX_ENTRIES);
      }
    } catch { /* ignore */ }
  }
}

export function recordScan(entry: Omit<ScanHistoryEntry, "timestamp">): void {
  const full: ScanHistoryEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  history.push(full);
  if (history.length > MAX_ENTRIES) {
    history = history.slice(-MAX_ENTRIES);
  }
  if (workspaceState) {
    void workspaceState.update(STORAGE_KEY, JSON.stringify(history));
  }
}

export function getScanHistory(): ScanHistoryData {
  if (history.length === 0) {
    return {
      entries: [],
      trend: "stable",
      delta: 0,
      bestScore: 0,
      worstScore: 0,
      averageScore: 0,
    };
  }

  const scores = history.map((h) => h.score);
  const bestScore = Math.max(...scores);
  const worstScore = Math.min(...scores);
  const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  let delta = 0;
  let trend: "improving" | "stable" | "declining" = "stable";

  if (history.length >= 2) {
    const prev = history[history.length - 2].score;
    const curr = history[history.length - 1].score;
    delta = curr - prev;

    // Look at last 5 scans for trend
    const recent = scores.slice(-5);
    if (recent.length >= 3) {
      const first = recent.slice(0, Math.ceil(recent.length / 2));
      const second = recent.slice(Math.ceil(recent.length / 2));
      const firstAvg = first.reduce((a, b) => a + b, 0) / first.length;
      const secondAvg = second.reduce((a, b) => a + b, 0) / second.length;
      if (secondAvg - firstAvg > 3) trend = "improving";
      else if (firstAvg - secondAvg > 3) trend = "declining";
    }
  }

  return {
    entries: [...history],
    trend,
    delta,
    bestScore,
    worstScore,
    averageScore,
  };
}

/**
 * Generate SVG sparkline path for the Hub.
 * Returns an SVG path string for use in an inline <svg>.
 */
export function generateSparklineSvg(width = 400, height = 60): string {
  if (history.length < 2) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="${width / 2}" y="${height / 2 + 4}" text-anchor="middle" fill="#849396" font-size="11" font-family="Inter">Run scans to see your trend</text>
    </svg>`;
  }

  const padding = 4;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const scores = history.map((e) => e.score);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = max - min || 1;

  const points = scores.map((score, i) => {
    const x = padding + (i / (scores.length - 1)) * w;
    const y = padding + h - ((score - min) / range) * h;
    return `${x},${y}`;
  });

  const linePath = `M${points.join(" L")}`;
  const areaPath = `${linePath} L${padding + w},${padding + h} L${padding},${padding + h} Z`;

  // Color based on latest score
  const latest = scores[scores.length - 1];
  const color = latest >= 80 ? "#10b981" : latest >= 50 ? "#fbbf24" : "#ef4444";
  const fillColor = latest >= 80 ? "rgba(16,185,129,0.1)" : latest >= 50 ? "rgba(251,191,36,0.08)" : "rgba(239,68,68,0.08)";

  // Dot for latest value
  const lastX = padding + w;
  const lastY = padding + h - ((latest - min) / range) * h;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="${areaPath}" fill="${fillColor}"/>
    <path d="${linePath}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="${lastX}" cy="${lastY}" r="3" fill="${color}" stroke="${color}" stroke-width="1"/>
  </svg>`;
}
