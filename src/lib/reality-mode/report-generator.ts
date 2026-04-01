import { RealityModeResult } from "./types";

export class ReportGenerator {
  generateHtml(result: RealityModeResult): string {
    let verdictDisplay = "GO";
    let verdictColor = "#10b981"; // Green
    let verdictIcon = "✅";

    if (result.verdict === "fake") {
      verdictDisplay = "NO-GO";
      verdictColor = "#ef4444"; // Red
      verdictIcon = "🛑";
    } else if (result.verdict === "suspicious") {
      verdictDisplay = "WARN";
      verdictColor = "#f59e0b"; // Amber
      verdictIcon = "⚠️";
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reality Mode Report</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 0; background: #f9fafb; color: #1f2937; }
    .container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
    .header { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
    .verdict { font-size: 2.5rem; font-weight: 800; color: ${verdictColor}; display: flex; align-items: center; gap: 0.75rem; letter-spacing: -0.025em; }
    .score-badge { background: ${verdictColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 1rem; font-weight: bold; }
    .section { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
    .section-title { font-size: 1.25rem; font-weight: bold; margin-bottom: 1rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
    .detection { border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid #ef4444; }
    .detection.warning { border-left-color: #f59e0b; }
    .detection-title { font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
    .evidence { background: #f3f4f6; padding: 0.75rem; border-radius: 0.25rem; margin-top: 0.5rem; font-family: monospace; font-size: 0.875rem; overflow-x: auto; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .summary-item { background: #f3f4f6; padding: 1rem; border-radius: 0.375rem; text-align: center; }
    .summary-value { font-size: 1.5rem; font-weight: bold; }
    .summary-label { color: #6b7280; font-size: 0.875rem; }
    .replay-step { border-left: 2px solid #d1d5db; padding-left: 1rem; margin-bottom: 1rem; position: relative; }
    .replay-step::before { content: ''; position: absolute; left: -5px; top: 0; width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; }
    .replay-step.request::before { background: #3b82f6; }
    .replay-step.action::before { background: #10b981; }
    .replay-step.detection::before { background: #ef4444; }
    .timestamp { color: #9ca3af; font-size: 0.75rem; }
    .failure-chip { display: inline-flex; align-items: center; background: #fee2e2; color: #991b1b; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: bold; margin-right: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .failure-chip.auth { background: #fef3c7; color: #92400e; } /* Amber for Auth */
    .failure-chip.schema { background: #e0e7ff; color: #1e40af; } /* Blue for Schema */
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: #6b7280; text-transform: uppercase;">Reality Check</h1>
          <div class="verdict">${verdictIcon} ${verdictDisplay}</div>
        </div>
        <div class="score-badge">Score: ${result.score}/100</div>
      </div>
      <p style="margin-top: 1rem; color: #6b7280;">Generated: ${result.timestamp}</p>
    </div>

    <div class="section">
      <h2 class="section-title">Summary</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${result.summary.totalRequests}</div>
          <div class="summary-label">Total Requests</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${result.summary.fakeRequests}</div>
          <div class="summary-label">Fake/Mock Requests</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${result.summary.criticalIssues}</div>
          <div class="summary-label">Critical Issues</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${result.summary.warnings}</div>
          <div class="summary-label">Warnings</div>
        </div>
      </div>
    </div>

    ${this.renderDetections(result)}
    ${this.renderFakeSuccess(result)}
    ${this.renderTrafficAnalysis(result)}
    ${this.renderAuthViolations(result)}

    <div class="section">
      <h2 class="section-title">Flight Recorder Replay</h2>
      <div class="replay-log">
        ${result.replay.map((step) => this.renderReplayStep(step)).join("")}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private getBrandedChip(text: string): string {
    const t = text.toLowerCase();
    if (t.includes("mock backend"))
      return '<span class="failure-chip">MOCK BACKEND</span>';
    if (t.includes("fake success"))
      return '<span class="failure-chip">FAKE SUCCESS</span>';
    if (t.includes("no-wire"))
      return '<span class="failure-chip">NO-WIRE UI</span>';
    if (t.includes("auth mirage"))
      return '<span class="failure-chip auth">AUTH MIRAGE</span>';
    if (t.includes("schema drift") || t.includes("missing wiring"))
      return '<span class="failure-chip schema">SCHEMA DRIFT</span>';
    return "";
  }

  private renderDetections(result: RealityModeResult): string {
    if (result.detections.length === 0) return "";

    return `
    <div class="section">
      <h2 class="section-title">Issues Detected</h2>
      ${result.detections
        .map(
          (d) => `
        <div class="detection ${d.pattern.severity === "warning" ? "warning" : ""}">
          <div class="detection-title">
            <span>${this.getBrandedChip(d.pattern.name)} ${d.pattern.name}</span>
            <span style="font-size: 0.75rem; text-transform: uppercase; color: #6b7280;">${d.pattern.severity}</span>
          </div>
          <p>${d.pattern.description}</p>
          <div class="evidence">
            ${d.evidence}<br>
            ${d.request ? `URL: ${d.request.url}` : ""}
            ${d.response ? `URL: ${d.response.url}` : ""}
          </div>
        </div>
      `,
        )
        .join("")}
    </div>`;
  }

  private renderFakeSuccess(result: RealityModeResult): string {
    const fakes = result.fakeSuccessAnalysis?.filter((f) => f.isFake) || [];
    if (fakes.length === 0) return "";

    return `
    <div class="section">
      <h2 class="section-title">🚨 Fake Success Detected</h2>
      <p style="color: #ef4444; margin-bottom: 1rem;">Actions appeared to succeed but triggered no backend persistence.</p>
      ${fakes
        .map(
          (f) => `
        <div class="detection">
          <div class="detection-title"><span class="failure-chip">FAKE SUCCESS</span> Action Failed Persistence</div>
          <div class="evidence">${f.evidence.join("<br>")}</div>
        </div>
      `,
        )
        .join("")}
    </div>`;
  }

  private renderTrafficAnalysis(result: RealityModeResult): string {
    const red =
      result.trafficAnalysis?.filter((t) => t.verdict === "red") || [];
    const yellow =
      result.trafficAnalysis?.filter((t) => t.verdict === "yellow") || [];
    const issues = [...red, ...yellow];

    if (issues.length === 0) return "";

    return `
    <div class="section">
      <h2 class="section-title">Traffic Analysis Issues</h2>
      ${issues
        .map(
          (t) => `
        <div class="detection ${t.verdict === "yellow" ? "warning" : ""}">
          <div class="detection-title">
            <span>${this.getBrandedChip(t.reasons.join(" "))} Traffic Analysis: ${t.verdict.toUpperCase()}</span>
          </div>
          <div class="evidence">${t.reasons.join("<br>")}</div>
        </div>
      `,
        )
        .join("")}
    </div>`;
  }

  private renderAuthViolations(result: RealityModeResult): string {
    if (!result.authViolations || result.authViolations.length === 0) return "";

    return `
    <div class="section">
      <h2 class="section-title">🔐 Auth Violations</h2>
      ${result.authViolations
        .map(
          (v) => `
        <div class="detection">
          <div class="detection-title">
            <span><span class="failure-chip auth">AUTH MIRAGE</span> ${v.type}</span>
          </div>
          <div class="evidence">
            Route: ${v.route}<br>
            Status: ${v.status} (Expected 401/403/Redirect)
          </div>
        </div>
      `,
        )
        .join("")}
    </div>`;
  }

  private renderReplayStep(step: any): string {
    let content = "";
    let className = "replay-step";

    if (step.type === "request") {
      className += " request";
      content = `<strong>Request:</strong> ${step.data.method} ${step.data.url}`;
    } else if (step.type === "response") {
      className += " request"; // group with request visually
      content = `<strong>Response:</strong> ${step.data.status} ${step.data.url}`;
    } else if (step.type === "action") {
      className += " action";
      content = `<strong>Action:</strong> ${step.data.type} ${step.data.selector || step.data.url}`;
    } else if (step.type === "console") {
      className += " console";
      const isError = step.data.type === "error";
      const color = isError ? "#ef4444" : "#6b7280";
      content = `<strong style="color: ${color}">Console ${step.data.type}:</strong> <span style="font-family: monospace">${step.data.text}</span>`;
    }

    if (step.detections && step.detections.length > 0) {
      className += " detection";
      content += `<div style="color: #ef4444; font-size: 0.875rem; margin-top: 0.25rem;">⚠️ Issue detected here</div>`;
    }

    if (step.screenshot) {
      content += `<div style="margin-top: 0.5rem;"><img src="./${step.screenshot}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px; max-height: 300px; cursor: pointer;" onclick="this.style.maxHeight='none'" loading="lazy" alt="Step Screenshot"></div>`;
    }

    return `
      <div class="${className}">
        <div class="timestamp">${new Date(step.timestamp).toISOString().split("T")[1].slice(0, -1)}</div>
        <div>${content}</div>
      </div>
    `;
  }
}
