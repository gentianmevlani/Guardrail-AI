/**
 * Security Scanner webview document (Stitch SECURITY_ARCHIVE layout).
 */

export function getSecurityScannerStitchHtml(headHtml: string): string {
  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Scanner</title>
  ${headHtml}
</head>
<body class="ka-dashboard-body ka-panel-page ss-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <header class="ss-head">
    <div class="ss-head-left">
      <span class="material-symbols-outlined" style="color:#22d3ee;">security</span>
      <h1 class="ss-head-title">SECURITY_ARCHIVE</h1>
    </div>
    <div class="ss-head-actions">
      <button type="button" class="ss-btn-run" id="scanBtn" onclick="runScan()">
        <span class="material-symbols-outlined" style="font-size:18px;">play_arrow</span>
        RUN SCAN
      </button>
      <button type="button" class="ss-icon-btn" title="Settings" onclick="openSettings()">
        <span class="material-symbols-outlined">settings</span>
      </button>
    </div>
  </header>

  <div class="ka-shell">
  <main class="ss-main">
    <div class="action-row anim">
      <button class="btn btn-secondary" id="sbomBtn" onclick="exportSBOM()" disabled>
        <span class="material-symbols-outlined" style="font-size:16px;">description</span> SBOM
      </button>
      <button class="btn btn-secondary" id="exportBtn" onclick="exportReport()" disabled>
        <span class="material-symbols-outlined" style="font-size:16px;">download</span> Export
      </button>
    </div>

    <div class="progress-container" id="progressContainer">
      <div class="progress-msg" id="progressMessage">Initializing security scan...</div>
      <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width: 0%"></div></div>
    </div>

    <div class="dashboard" id="dashboard">
      <div class="ss-hero-grid">
        <div class="ss-score-card">
          <div class="ss-score-inner">
            <div class="ss-ring-wrap">
              <svg width="192" height="192" viewBox="0 0 192 192" style="transform:rotate(-90deg);">
                <circle cx="96" cy="96" r="88" fill="transparent" stroke="var(--surface-container-highest)" stroke-width="2"></circle>
                <circle id="scoreRingFill" cx="96" cy="96" r="88" fill="transparent" stroke="var(--primary-container)" stroke-width="4"
                  stroke-dasharray="552.92" stroke-dashoffset="552.92" stroke-linecap="round"></circle>
                <circle class="ss-radar-sweep" cx="96" cy="96" r="88" fill="transparent" stroke="rgba(0,229,255,0.2)" stroke-dasharray="10 542.92" stroke-width="8"></circle>
              </svg>
              <div class="ss-ring-center">
                <span class="ss-score-num ss-pulse-ring" id="scoreValue">--</span>
                <span class="ss-score-denom">/100</span>
              </div>
            </div>
            <div class="ss-score-copy">
              <div class="ss-badge-pill"><span class="ss-dot-pulse"></span><span>SEC SCORE: NOMINAL</span></div>
              <h2 class="ss-hero-h2">System integrity verified.</h2>
              <p class="ss-hero-p">Run a scan to analyze vulnerabilities and secrets in your workspace.</p>
            </div>
          </div>
        </div>
        <div class="ss-files-card">
          <div>
            <p class="ss-files-label">FILES_SCANNED</p>
            <p class="ss-files-val" id="filesScannedVal">—</p>
          </div>
          <div style="margin-top:16px;font-size:10px;color:var(--on-surface-variant);letter-spacing:0.1em;">LAST SESSION METRICS</div>
        </div>
      </div>

      <div class="ss-summary-3">
        <div class="ss-sum-card crit">
          <div>
            <p class="ss-sum-lbl crit">CRITICAL</p>
            <p class="ss-sum-num" id="criticalCount">0</p>
          </div>
          <span class="material-symbols-outlined" style="color:rgba(255,180,171,0.35);font-size:28px;">gpp_bad</span>
        </div>
        <div class="ss-sum-card warn">
          <div>
            <p class="ss-sum-lbl warn">WARNINGS</p>
            <p class="ss-sum-num" id="warningCount">0</p>
          </div>
          <span class="material-symbols-outlined" style="color:rgba(255,179,179,0.35);font-size:28px;">warning</span>
        </div>
        <div class="ss-sum-card ok">
          <div>
            <p class="ss-sum-lbl ok">LOW</p>
            <p class="ss-sum-num" id="lowCount">0</p>
          </div>
          <span class="material-symbols-outlined" style="color:rgba(0,229,255,0.35);font-size:28px;">check_circle</span>
        </div>
      </div>

      <div id="freeTierBanner" class="free-tier-banner" style="display:none;">
        <span><strong>Free plan</strong> — severity counts only. Upgrade to see titles, files, and fixes.</span>
        <button type="button" class="btn btn-secondary" onclick="openBilling()">View plans</button>
      </div>

      <div class="ss-vault" id="vaultBanner">
        <div class="ss-vault-left">
          <div class="ss-vault-ico"><span class="material-symbols-outlined">lock_reset</span></div>
          <div>
            <h5 style="margin:0;font-family:'Space Grotesk',sans-serif;font-weight:700;color:var(--on-surface);">Vault Integration Required</h5>
            <p style="margin:4px 0 0;font-size:13px;color:var(--on-surface-variant);">Secrets Manager not configured. Sensitive strings may be at risk.</p>
          </div>
        </div>
        <button type="button" class="ss-vault-btn" onclick="configureVault()">CONFIGURE</button>
      </div>

      <section>
        <div class="ss-section-head" style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px;">
          <div>
            <h2>Security Issues</h2>
            <p>Filtered findings from the latest scan.</p>
          </div>
          <div class="ss-filter-row">
            <button class="filter-tab active" data-filter="all">ALL</button>
            <button class="filter-tab" data-filter="critical">CRITICAL</button>
            <button class="filter-tab" data-filter="high">HIGH</button>
            <button class="filter-tab" data-filter="medium">MEDIUM</button>
            <button class="filter-tab" data-filter="low">LOW</button>
          </div>
        </div>
        <div id="issuesList"></div>
      </section>
    </div>

    <div class="empty-state" id="emptyState">
      <span class="material-symbols-outlined">security</span>
      <h3>No Security Scan Yet</h3>
      <p>Click <strong>RUN SCAN</strong> to analyze your codebase.</p>
    </div>
  </main>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentReport = null;
    let currentFilter = 'all';

    function openSettings() {
      vscode.postMessage({ command: 'vscodeCommand', id: 'workbench.action.openSettings' });
    }

    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        renderIssues();
      });
    });

    function runScan() { document.getElementById('scanBtn').disabled = true; vscode.postMessage({ command: 'scan' }); }
    function configureVault() { vscode.postMessage({ command: 'configureVault' }); }
    function exportSBOM() { vscode.postMessage({ command: 'exportSBOM' }); }
    function exportReport() { vscode.postMessage({ command: 'export' }); }
    function openBilling() { vscode.postMessage({ command: 'openBilling' }); }
    function openFile(file, line) { vscode.postMessage({ command: 'openFile', file, line }); }
    function applyFix(issueId) { event.stopPropagation(); vscode.postMessage({ command: 'applyFix', issueId }); }

    function getScoreColor(score) {
      if (score >= 80) return '#00daf3';
      if (score >= 60) return '#ffb786';
      return '#ffb4ab';
    }

    function setScoreRing(score) {
      var el = document.getElementById('scoreRingFill');
      if (!el) return;
      var c = 552.92;
      var pct = Math.max(0, Math.min(100, score));
      el.setAttribute('stroke-dashoffset', String(c * (1 - pct / 100)));
    }

    function renderIssues() {
      if (!currentReport) return;
      if (currentReport.issueDetailsLocked) {
        document.querySelector('.ss-filter-row').style.display = 'none';
        document.getElementById('issuesList').innerHTML = \`
        <div class="free-tier-lock">
          <div class="free-tier-lock-card">
            <span class="material-symbols-outlined">lock</span>
            <div class="issue-title">Issue details are hidden on the Free plan</div>
            <div class="sub">Upgrade to unlock titles, file paths, code snippets, and remediation.</div>
            <button type="button" class="btn" onclick="openBilling()">Upgrade to see issues</button>
          </div>
        </div>\`;
        return;
      }
      document.querySelector('.ss-filter-row').style.display = 'flex';
      let issues = currentReport.issues;
      if (currentFilter !== 'all') { issues = issues.filter(i => i.severity === currentFilter); }
      document.getElementById('issuesList').innerHTML = issues.map(issue => \`
        <div class="issue-card \${issue.severity}" onclick="openFile('\${issue.file}', \${issue.line || 1})">
          <div class="issue-header">
            <span class="issue-title">\${issue.title}</span>
            <span class="issue-badge badge-\${issue.severity}">\${issue.severity.toUpperCase()}</span>
          </div>
          <div class="issue-meta">
            <span>\${issue.file || 'N/A'}</span>
            \${issue.line ? \`<span>Line \${issue.line}</span>\` : ''}
            \${issue.cwe ? \`<span>\${issue.cwe}</span>\` : ''}
            \${issue.owasp ? \`<span>OWASP \${issue.owasp}</span>\` : ''}
          </div>
          <div class="issue-description">\${issue.description}</div>
          \${issue.code ? \`<div class="issue-code">\${issue.code}</div>\` : ''}
          \${issue.fix ? \`<div class="issue-fix">\${issue.fix}</div>\` : ''}
        </div>
      \`).join('');
    }

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'scanning': case 'progress':
          document.getElementById('progressContainer').style.display = 'block';
          document.getElementById('progressMessage').textContent = message.message || 'Scanning...';
          document.getElementById('progressFill').style.width = (message.progress || 0) + '%';
          break;
        case 'complete':
          document.getElementById('progressContainer').style.display = 'none';
          document.getElementById('scanBtn').disabled = false;
          document.getElementById('sbomBtn').disabled = false;
          document.getElementById('exportBtn').disabled = false;
          document.getElementById('emptyState').style.display = 'none';
          document.getElementById('dashboard').style.display = 'block';
          currentReport = message.report;
          var sc = currentReport.score;
          document.getElementById('scoreValue').textContent = sc;
          document.getElementById('scoreValue').style.color = getScoreColor(sc);
          setScoreRing(sc);
          document.getElementById('criticalCount').textContent = currentReport.summary.critical;
          document.getElementById('warningCount').textContent =
            currentReport.summary.high + currentReport.summary.medium;
          document.getElementById('lowCount').textContent = currentReport.summary.low;
          var fb = document.getElementById('freeTierBanner');
          if (fb) fb.style.display = currentReport.issueDetailsLocked ? 'flex' : 'none';
          renderIssues();
          break;
        case 'error':
          document.getElementById('progressContainer').style.display = 'none';
          document.getElementById('scanBtn').disabled = false;
          break;
      }
    });
  </script>
</body>
</html>`;
}
