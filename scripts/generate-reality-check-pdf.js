#!/usr/bin/env node

/**
 * Reality Check PDF Report Generator
 *
 * Generates a beautiful dark-themed PDF report from reality check results.
 *
 * Usage: node scripts/generate-reality-check-pdf.js [projectPath] [outputPath]
 */

const fs = require("fs");
const path = require("path");

/**
 * Generate HTML for dark-themed PDF
 */
function generatePdfHtml(data) {
  const { projectPath, result, findings, timestamp } = data;

  const getGradeColor = (grade) => {
    if (grade.startsWith("A")) return "#10b981";
    if (grade.startsWith("B")) return "#3b82f6";
    if (grade.startsWith("C")) return "#eab308";
    if (grade.startsWith("D")) return "#f97316";
    return "#ef4444";
  };

  const gradeColor = getGradeColor(result.grade);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reality Check Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #0a0a0f 0%, #12121a 100%);
      color: #e5e5e5;
      min-height: 100vh;
      padding: 40px;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    
    /* Header */
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 1px solid rgba(139, 92, 246, 0.3);
    }
    
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .logo-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(139, 92, 246, 0.3);
    }
    
    .logo-icon svg {
      width: 28px;
      height: 28px;
      color: #a855f7;
    }
    
    h1 {
      font-size: 36px;
      font-weight: 800;
      background: linear-gradient(135deg, #a855f7, #ec4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .subtitle {
      color: #9ca3af;
      font-size: 14px;
      margin-top: 8px;
    }
    
    .meta {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 16px;
      font-size: 12px;
      color: #6b7280;
    }
    
    /* Score Section */
    .score-section {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
      margin-bottom: 40px;
    }
    
    .score-card {
      background: rgba(18, 18, 26, 0.8);
      border: 1px solid rgba(55, 65, 81, 0.5);
      border-radius: 16px;
      padding: 32px;
    }
    
    .score-display {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    
    .score-number {
      font-size: 72px;
      font-weight: 800;
      color: ${gradeColor};
      line-height: 1;
    }
    
    .score-max {
      font-size: 32px;
      color: #4b5563;
    }
    
    .grade {
      font-size: 24px;
      font-weight: 700;
      color: ${gradeColor};
      margin-top: 8px;
    }
    
    .score-bar {
      height: 8px;
      background: #1f2937;
      border-radius: 4px;
      margin-top: 24px;
      overflow: hidden;
    }
    
    .score-fill {
      height: 100%;
      background: linear-gradient(90deg, ${gradeColor}, ${gradeColor}dd);
      border-radius: 4px;
      width: ${result.score}%;
    }
    
    /* Verdict Box */
    .verdict-box {
      background: ${result.canShip ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"};
      border: 1px solid ${result.canShip ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"};
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .verdict-icon {
      width: 64px;
      height: 64px;
      margin-bottom: 12px;
    }
    
    .verdict-text {
      font-size: 18px;
      font-weight: 700;
      color: ${result.canShip ? "#10b981" : "#ef4444"};
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 40px;
    }
    
    .stat-card {
      background: rgba(18, 18, 26, 0.8);
      border: 1px solid rgba(55, 65, 81, 0.5);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    
    .stat-value.good { color: #10b981; }
    .stat-value.bad { color: #ef4444; }
    
    .stat-label {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Reality Table */
    .section {
      margin-bottom: 32px;
    }
    
    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section-title::before {
      content: '';
      width: 4px;
      height: 20px;
      background: linear-gradient(135deg, #a855f7, #ec4899);
      border-radius: 2px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: rgba(18, 18, 26, 0.8);
      border-radius: 12px;
      overflow: hidden;
    }
    
    th {
      background: rgba(26, 26, 36, 0.8);
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    td {
      padding: 12px 16px;
      border-top: 1px solid rgba(55, 65, 81, 0.3);
      font-size: 14px;
    }
    
    .status-good { color: #10b981; }
    .status-bad { color: #ef4444; }
    
    /* Deductions */
    .deductions {
      background: rgba(18, 18, 26, 0.8);
      border: 1px solid rgba(55, 65, 81, 0.5);
      border-radius: 12px;
      padding: 20px;
    }
    
    .deduction-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(55, 65, 81, 0.3);
    }
    
    .deduction-row:last-child {
      border-bottom: none;
      padding-top: 12px;
      margin-top: 8px;
      border-top: 1px solid rgba(139, 92, 246, 0.3);
    }
    
    .deduction-category { color: #9ca3af; }
    .deduction-points { font-family: 'JetBrains Mono', monospace; color: #ef4444; }
    .deduction-points.positive { color: #10b981; }
    .deduction-final { font-weight: 700; color: ${gradeColor}; }
    
    /* Footer */
    .footer {
      text-align: center;
      padding-top: 32px;
      border-top: 1px solid rgba(55, 65, 81, 0.3);
      margin-top: 40px;
    }
    
    .footer-text {
      font-size: 12px;
      color: #6b7280;
    }
    
    .footer-brand {
      font-weight: 600;
      background: linear-gradient(135deg, #a855f7, #ec4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    /* Action Items */
    .action-item {
      background: rgba(18, 18, 26, 0.8);
      border-left: 4px solid;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }
    
    .action-item.p0 { border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }
    .action-item.p1 { border-color: #f97316; background: rgba(249, 115, 22, 0.1); }
    .action-item.p2 { border-color: #eab308; background: rgba(234, 179, 8, 0.1); }
    
    .action-priority {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 4px;
      margin-right: 8px;
    }
    
    .action-item.p0 .action-priority { background: rgba(239, 68, 68, 0.3); color: #ef4444; }
    .action-item.p1 .action-priority { background: rgba(249, 115, 22, 0.3); color: #f97316; }
    .action-item.p2 .action-priority { background: rgba(234, 179, 8, 0.3); color: #eab308; }
    
    .action-title {
      font-weight: 600;
      font-size: 14px;
    }
    
    .action-description {
      font-size: 13px;
      color: #9ca3af;
      margin-top: 4px;
    }
    
    /* Page break for printing */
    @media print {
      body { background: #0a0a0f; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <h1>Reality Check</h1>
      </div>
      <p class="subtitle">"Where Your Code Lies To You"</p>
      <div class="meta">
        <span>📁 ${projectPath}</span>
        <span>📅 ${timestamp || new Date().toISOString()}</span>
      </div>
    </div>
    
    <!-- Score Section -->
    <div class="score-section">
      <div class="score-card">
        <div class="score-display">
          <span class="score-number">${result.score}</span>
          <span class="score-max">/100</span>
        </div>
        <div class="grade">Grade: ${result.grade}</div>
        <div class="score-bar">
          <div class="score-fill"></div>
        </div>
      </div>
      
      <div class="verdict-box">
        ${
          result.canShip
            ? `<svg class="verdict-icon" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <div class="verdict-text">CLEAR TO SHIP</div>`
            : `<svg class="verdict-icon" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <div class="verdict-text">NOT READY</div>`
        }
      </div>
    </div>
    
    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value ${result.counts.api.missing === 0 ? "good" : "bad"}">${result.counts.api.missing}</div>
        <div class="stat-label">Missing APIs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value ${result.counts.auth.exposed === 0 ? "good" : "bad"}">${result.counts.auth.exposed}</div>
        <div class="stat-label">Exposed Auth</div>
      </div>
      <div class="stat-card">
        <div class="stat-value ${result.counts.secrets.critical === 0 ? "good" : "bad"}">${result.counts.secrets.critical}</div>
        <div class="stat-label">Secrets</div>
      </div>
      <div class="stat-card">
        <div class="stat-value ${result.counts.routes.deadLinks === 0 ? "good" : "bad"}">${result.counts.routes.deadLinks}</div>
        <div class="stat-label">Dead Links</div>
      </div>
      <div class="stat-card">
        <div class="stat-value ${result.counts.mocks.critical + result.counts.mocks.high === 0 ? "good" : "bad"}">${result.counts.mocks.critical + result.counts.mocks.high}</div>
        <div class="stat-label">Mock Code</div>
      </div>
    </div>
    
    <!-- Reality Table -->
    <div class="section">
      <h2 class="section-title">The Reality</h2>
      <table>
        <thead>
          <tr>
            <th>What You Think</th>
            <th>The Truth</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>"All APIs work"</td>
            <td>${result.counts.api.missing} endpoints don't exist</td>
            <td class="${result.counts.api.missing === 0 ? "status-good" : "status-bad"}">${result.counts.api.missing === 0 ? "✅" : "❌"}</td>
          </tr>
          <tr>
            <td>"App is secure"</td>
            <td>${result.counts.auth.exposed} sensitive endpoints exposed</td>
            <td class="${result.counts.auth.exposed === 0 ? "status-good" : "status-bad"}">${result.counts.auth.exposed === 0 ? "✅" : "❌"}</td>
          </tr>
          <tr>
            <td>"Secrets are safe"</td>
            <td>${result.counts.secrets.critical} hardcoded in code</td>
            <td class="${result.counts.secrets.critical === 0 ? "status-good" : "status-bad"}">${result.counts.secrets.critical === 0 ? "✅" : "❌"}</td>
          </tr>
          <tr>
            <td>"All pages work"</td>
            <td>${result.counts.routes.deadLinks} links go to 404</td>
            <td class="${result.counts.routes.deadLinks === 0 ? "status-good" : "status-bad"}">${result.counts.routes.deadLinks === 0 ? "✅" : "❌"}</td>
          </tr>
          <tr>
            <td>"No test code in prod"</td>
            <td>${result.counts.mocks.critical + result.counts.mocks.high} mock/test issues</td>
            <td class="${result.counts.mocks.critical + result.counts.mocks.high === 0 ? "status-good" : "status-bad"}">${result.counts.mocks.critical + result.counts.mocks.high === 0 ? "✅" : "❌"}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Score Breakdown -->
    ${
      result.deductions && result.deductions.length > 0
        ? `
    <div class="section">
      <h2 class="section-title">Score Breakdown</h2>
      <div class="deductions">
        <div class="deduction-row">
          <span class="deduction-category">Base Score</span>
          <span class="deduction-points positive">100</span>
        </div>
        ${result.deductions
          .map(
            (d) => `
        <div class="deduction-row">
          <span class="deduction-category">${d.category}</span>
          <span class="deduction-points">${d.points}</span>
        </div>
        `,
          )
          .join("")}
        <div class="deduction-row">
          <span class="deduction-category" style="font-weight: 700;">Final Score</span>
          <span class="deduction-final">${result.score}</span>
        </div>
      </div>
    </div>
    `
        : ""
    }
    
    <!-- Action Items -->
    <div class="section">
      <h2 class="section-title">Action Items</h2>
      ${
        result.counts.secrets.critical > 0
          ? `
      <div class="action-item p0">
        <span class="action-priority">P0</span>
        <span class="action-title">Remove hardcoded secrets</span>
        <p class="action-description">${result.counts.secrets.critical} critical secrets found. Rotate immediately.</p>
      </div>
      `
          : ""
      }
      ${
        result.counts.mocks.critical > 0
          ? `
      <div class="action-item p0">
        <span class="action-priority">P0</span>
        <span class="action-title">Remove test code from production</span>
        <p class="action-description">${result.counts.mocks.critical} critical mock/test issues.</p>
      </div>
      `
          : ""
      }
      ${
        result.counts.auth.exposed > 0
          ? `
      <div class="action-item p0">
        <span class="action-priority">P0</span>
        <span class="action-title">Secure exposed endpoints</span>
        <p class="action-description">${result.counts.auth.exposed} sensitive endpoints unprotected.</p>
      </div>
      `
          : ""
      }
      ${
        result.counts.api.missing > 0
          ? `
      <div class="action-item p1">
        <span class="action-priority">P1</span>
        <span class="action-title">Implement missing API endpoints</span>
        <p class="action-description">${result.counts.api.missing} frontend calls have no backend.</p>
      </div>
      `
          : ""
      }
      ${
        result.counts.routes.deadLinks > 0
          ? `
      <div class="action-item p2">
        <span class="action-priority">P2</span>
        <span class="action-title">Fix dead links</span>
        <p class="action-description">${result.counts.routes.deadLinks} links point to 404.</p>
      </div>
      `
          : ""
      }
      ${
        result.canShip
          ? `
      <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin-top: 16px;">
        <div style="font-size: 32px; margin-bottom: 8px;">🚀</div>
        <div style="font-size: 18px; font-weight: 700; color: #10b981;">Ready to Ship!</div>
        <div style="font-size: 13px; color: #9ca3af; margin-top: 4px;">No critical issues blocking deployment.</div>
      </div>
      `
          : ""
      }
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p class="footer-text">Generated by <span class="footer-brand">guardrail AI</span> • Reality Check Report</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate PDF using puppeteer (if available) or return HTML
 */
async function generatePdf(data, outputPath) {
  const html = generatePdfHtml(data);

  // Try to use puppeteer for PDF generation
  try {
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
    });

    await browser.close();

    if (outputPath) {
      fs.writeFileSync(outputPath, pdfBuffer);
      return outputPath;
    }

    return pdfBuffer;
  } catch (err) {
    // Puppeteer not available, return HTML instead
    console.warn("Puppeteer not available, returning HTML");

    if (outputPath) {
      const htmlPath = outputPath.replace(".pdf", ".html");
      fs.writeFileSync(htmlPath, html);
      return htmlPath;
    }

    return html;
  }
}

module.exports = { generatePdfHtml, generatePdf };

// CLI execution
if (require.main === module) {
  const projectPath = process.argv[2] || ".";
  const outputPath =
    process.argv[3] ||
    `reality-check-${new Date().toISOString().split("T")[0]}.pdf`;

  // Mock data for testing
  const mockData = {
    projectPath,
    timestamp: new Date().toISOString(),
    result: {
      score: 46,
      grade: "F",
      canShip: false,
      counts: {
        api: { connected: 42, missing: 127 },
        auth: { protected: 50, exposed: 8 },
        secrets: { critical: 6 },
        routes: { deadLinks: 13 },
        mocks: { critical: 14, high: 22 },
      },
      deductions: [
        { category: "Secrets (Critical)", points: -20, reason: "6 hardcoded" },
        {
          category: "Mock Code (Critical)",
          points: -15,
          reason: "14 mock issues",
        },
        { category: "Dead Links", points: -5, reason: "13 dead links" },
      ],
    },
  };

  generatePdf(mockData, outputPath)
    .then((result) => {
      console.log(`Report generated: ${result}`);
    })
    .catch((err) => {
      console.error("Failed to generate PDF:", err.message);
    });
}
