/**
 * HTML Report Generator for Ship Verdicts
 * Creates shareable, professional reports
 */
import * as fs from "fs";
import type { ShipReport, ShipBlocker } from "../commands/ship.js";

export async function generateHTMLReport(report: ShipReport, outputPath: string): Promise<void> {
  const html = buildHTML(report);
  await fs.promises.writeFile(outputPath, html, "utf-8");
}

function buildHTML(report: ShipReport): string {
  const verdictColors = {
    GO: "#22c55e",
    WARN: "#eab308",
    "NO-GO": "#ef4444",
  };

  const verdictEmojis = {
    GO: "✓",
    WARN: "⚠",
    "NO-GO": "✗",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>guardrail Ship Report - ${report.verdict}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 2rem;
      padding: 2rem;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      border-radius: 12px;
    }
    .logo { font-size: 1.5rem; color: #60a5fa; margin-bottom: 1rem; }
    .verdict {
      display: inline-block;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      font-size: 2rem;
      font-weight: bold;
      background: ${verdictColors[report.verdict]};
      color: white;
    }
    .timestamp { color: #94a3b8; margin-top: 1rem; font-size: 0.875rem; }
    .section {
      background: #1e293b;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .blocker { color: #f87171; }
    .warning { color: #fbbf24; }
    .passed { color: #4ade80; }
    .impact { color: #60a5fa; }
    .item {
      padding: 0.75rem;
      background: #0f172a;
      border-radius: 8px;
      margin-bottom: 0.5rem;
    }
    .item-category {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      background: #334155;
      margin-right: 0.5rem;
    }
    .item-file {
      color: #94a3b8;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
    .fix-plan {
      margin-top: 1rem;
      padding: 1rem;
      background: #0f172a;
      border-radius: 8px;
      border-left: 3px solid #a855f7;
    }
    .fix-command {
      font-family: monospace;
      background: #334155;
      padding: 0.5rem;
      border-radius: 4px;
      margin-top: 0.5rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }
    .stat-card {
      text-align: center;
      padding: 1rem;
      background: #0f172a;
      border-radius: 8px;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #60a5fa;
    }
    .stat-label {
      color: #94a3b8;
      font-size: 0.875rem;
    }
    .footer {
      text-align: center;
      color: #64748b;
      font-size: 0.875rem;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🛡️ guardrail</div>
      <div class="verdict">${verdictEmojis[report.verdict]} ${report.verdict}</div>
      <div class="timestamp">${new Date(report.timestamp).toLocaleString()}</div>
    </div>

    ${report.blockers.length > 0 ? `
    <div class="section">
      <div class="section-title blocker">✗ Blockers (${report.blockers.length})</div>
      ${report.blockers.map(b => renderItem(b, "blocker")).join("")}
    </div>
    ` : ""}

    ${report.warnings.length > 0 ? `
    <div class="section">
      <div class="section-title warning">⚠ Warnings (${report.warnings.length})</div>
      ${report.warnings.map(w => renderItem(w, "warning")).join("")}
    </div>
    ` : ""}

    ${report.passed.length > 0 ? `
    <div class="section">
      <div class="section-title passed">✓ Passed (${report.passed.length})</div>
      ${report.passed.map(p => `<div class="item">${p}</div>`).join("")}
    </div>
    ` : ""}

    <div class="section">
      <div class="section-title impact">🧠 Context Mode Impact (7 days)</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${report.contextImpact.hallucinationsBlocked7d}</div>
          <div class="stat-label">Hallucinations Blocked</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${report.contextImpact.patternsUsed}</div>
          <div class="stat-label">Patterns Used</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${report.contextImpact.topPreventedMistakes.length}</div>
          <div class="stat-label">Key Saves</div>
        </div>
      </div>
    </div>

    ${report.fixPlan.autoFixable.length > 0 || report.fixPlan.manual.length > 0 ? `
    <div class="section">
      <div class="section-title" style="color: #a855f7;">🔧 Fix Plan</div>
      ${report.fixPlan.autoFixable.length > 0 ? `
        <div class="fix-plan">
          <strong>Auto-fixable:</strong>
          ${report.fixPlan.autoFixable.map(f => `
            <div style="margin-top: 0.5rem;">• ${f.description}</div>
            ${f.command ? `<div class="fix-command">$ ${f.command}</div>` : ""}
          `).join("")}
        </div>
      ` : ""}
      ${report.fixPlan.manual.length > 0 ? `
        <div class="fix-plan" style="border-color: #fbbf24;">
          <strong>Manual fixes needed:</strong>
          ${report.fixPlan.manual.map(f => `<div style="margin-top: 0.5rem;">• ${f.description}</div>`).join("")}
        </div>
      ` : ""}
    </div>
    ` : ""}

    <div class="footer">
      Generated by guardrail Context Engine<br>
      <a href="https://guardrail.dev" style="color: #60a5fa;">guardrail.dev</a>
    </div>
  </div>
</body>
</html>`;
}

function renderItem(item: ShipBlocker, type: "blocker" | "warning"): string {
  return `
    <div class="item">
      <span class="item-category">${item.category}</span>
      <span class="${type === "blocker" ? "blocker" : "warning"}">${item.message}</span>
      ${item.file ? `<div class="item-file">→ ${item.file}${item.line ? `:${item.line}` : ""}</div>` : ""}
    </div>
  `;
}
