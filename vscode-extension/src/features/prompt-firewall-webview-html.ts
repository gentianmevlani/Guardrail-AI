/**
 * Prompt Firewall webview document (Stitch PROMPT_FIREWALL layout).
 */

export function getPromptFirewallStitchHtml(headHtml: string): string {
  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prompt Firewall</title>
  ${headHtml}
</head>
<body class="ka-dashboard-body ka-panel-page pf-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <header class="pf-head">
    <div class="pf-head-left">
      <span class="material-symbols-outlined" style="color:#22d3ee;">shield</span>
      <h1 class="pf-head-title">PROMPT_FIREWALL</h1>
    </div>
    <div class="pf-head-actions">
      <button type="button" class="pf-btn-analyze" id="analyzeBtn" onclick="analyze()">
        <span class="material-symbols-outlined" style="font-size:18px;">play_arrow</span>
        ANALYZE
      </button>
    </div>
  </header>

  <div class="ka-shell">
  <main class="pf-main">

    <!-- Input area -->
    <section class="pf-input-section">
      <label>Enter prompt to analyze</label>
      <textarea class="pf-textarea" id="promptInput" rows="6" placeholder="Paste your prompt here for firewall analysis..."></textarea>
      <div class="pf-options-row">
        <label><input type="checkbox" id="optBreakdown" checked> Task Breakdown</label>
        <label><input type="checkbox" id="optVerify" checked> Verify</label>
        <label><input type="checkbox" id="optFix" checked> Auto Fix</label>
        <label><input type="checkbox" id="optVcs"> Version Control</label>
        <label><input type="checkbox" id="optPlan" checked> Future Plan</label>
      </div>
    </section>

    <!-- Progress -->
    <div class="pf-progress" id="progressContainer">
      <div class="pf-progress-msg" id="progressMessage">Initializing prompt analysis...</div>
      <div class="pf-progress-bar"><div class="pf-progress-fill" id="progressFill"></div></div>
    </div>

    <!-- Error -->
    <div class="pf-error" id="errorContainer"></div>

    <!-- Empty state -->
    <div class="pf-empty" id="emptyState">
      <span class="material-symbols-outlined">shield</span>
      <h3>Prompt Firewall</h3>
      <p>Enter a prompt and click <strong>ANALYZE</strong> to run it through the firewall.<br>
      Checks for injection attacks, hallucination risk, PII leakage, and more.</p>
    </div>

    <!-- Results dashboard -->
    <div class="pf-dashboard" id="dashboard">

      <!-- Hero: Score + Injection status -->
      <div class="pf-hero-grid">
        <div class="pf-score-card">
          <div class="pf-ring-wrap">
            <svg width="160" height="160" viewBox="0 0 160 160" style="transform:rotate(-90deg);">
              <circle cx="80" cy="80" r="72" fill="transparent" stroke="var(--surface-container-highest, #2a2d32)" stroke-width="2"></circle>
              <circle id="scoreRingFill" cx="80" cy="80" r="72" fill="transparent" stroke="var(--primary-container, #22d3ee)" stroke-width="4"
                stroke-dasharray="452.39" stroke-dashoffset="452.39" stroke-linecap="round"></circle>
              <circle class="pf-radar-sweep" cx="80" cy="80" r="72" fill="transparent" stroke="rgba(0,229,255,0.2)" stroke-dasharray="10 442.39" stroke-width="8"></circle>
            </svg>
            <div class="pf-ring-center">
              <span class="pf-score-num pf-pulse-ring" id="scoreValue">--</span>
              <span class="pf-score-denom">/100</span>
            </div>
          </div>
          <div class="pf-score-label">VERIFICATION SCORE</div>
        </div>

        <div class="pf-injection-card">
          <span class="material-symbols-outlined pf-injection-icon clean" id="injectionIcon">verified_user</span>
          <div class="pf-injection-status clean" id="injectionStatus">AWAITING SCAN</div>
          <div style="margin-top:12px;font-size:11px;color:var(--on-surface-variant);" id="injectionDetail">Run analysis to check for injection patterns</div>
        </div>
      </div>

      <!-- Summary 3-col -->
      <div class="pf-summary-3">
        <div class="pf-summary-card">
          <div class="pf-summary-val" id="checksPassedVal">--</div>
          <div class="pf-summary-label">CHECKS PASSED</div>
        </div>
        <div class="pf-summary-card">
          <div class="pf-summary-val" id="piiCountVal">--</div>
          <div class="pf-summary-label">PII MATCHES</div>
        </div>
        <div class="pf-summary-card">
          <div class="pf-summary-val" id="tasksCountVal">--</div>
          <div class="pf-summary-label">TASKS IDENTIFIED</div>
        </div>
      </div>

      <!-- Verification Checks -->
      <section class="pf-section" id="checksSection" style="display:none;">
        <div class="pf-section-title">Verification Checks</div>
        <div id="checksList"></div>
      </section>

      <!-- Task Breakdown -->
      <section class="pf-section" id="tasksSection" style="display:none;">
        <div class="pf-section-title">Task Breakdown</div>
        <div id="tasksList"></div>
      </section>

      <!-- Immediate Fixes -->
      <section class="pf-section" id="fixesSection" style="display:none;">
        <div class="pf-section-title">Immediate Fixes</div>
        <div id="fixesList"></div>
      </section>

      <!-- Recommendations -->
      <section class="pf-section" id="recsSection" style="display:none;">
        <div class="pf-section-title">Recommendations</div>
        <div id="recsList"></div>
      </section>

      <!-- Upgrade CTA (shown for free tier) -->
      <div id="upgradeCta" style="display:none;margin-top:24px;"></div>
    </div>

  </main>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentResult = null;

    function analyze() {
      const prompt = document.getElementById('promptInput').value.trim();
      if (!prompt) return;
      const options = {
        autoBreakdown: document.getElementById('optBreakdown').checked,
        autoVerify: document.getElementById('optVerify').checked,
        autoFix: document.getElementById('optFix').checked,
        includeVersionControl: document.getElementById('optVcs').checked,
        generatePlan: document.getElementById('optPlan').checked,
      };
      vscode.postMessage({ command: 'analyze', prompt, options });
    }

    function applyFix(fixId) {
      if (!currentResult || !currentResult.firewallResult) return;
      const fix = currentResult.firewallResult.immediateFixes.find(f => f.id === fixId);
      if (fix) {
        vscode.postMessage({ command: 'applyFix', fixId, fix });
        const btn = document.getElementById('fix-btn-' + fixId);
        if (btn) { btn.disabled = true; btn.textContent = 'APPLYING...'; }
      }
    }

    function setProgress(msg, pct) {
      const el = document.getElementById('progressContainer');
      el.classList.add('active');
      document.getElementById('progressMessage').textContent = msg;
      document.getElementById('progressFill').style.width = pct + '%';
    }

    function hideProgress() {
      document.getElementById('progressContainer').classList.remove('active');
    }

    function showError(msg) {
      const el = document.getElementById('errorContainer');
      el.textContent = msg;
      el.classList.add('active');
    }

    function hideError() {
      document.getElementById('errorContainer').classList.remove('active');
    }

    function setScoreRing(score) {
      const circumference = 2 * Math.PI * 72; // 452.39
      const offset = circumference - (score / 100) * circumference;
      const fill = document.getElementById('scoreRingFill');
      if (fill) fill.setAttribute('stroke-dashoffset', String(offset));
      const num = document.getElementById('scoreValue');
      if (num) num.textContent = String(score);
    }

    function renderResult(result) {
      document.getElementById('emptyState').style.display = 'none';
      document.getElementById('dashboard').classList.add('active');
      hideError();

      const fw = result.firewallResult;
      const injection = result.injection;
      const pii = result.pii || [];
      const unicode = result.unicodeAnomalies || [];

      // Score
      if (fw && fw.verification) {
        setScoreRing(fw.verification.score);
      }

      // Injection status
      const iconEl = document.getElementById('injectionIcon');
      const statusEl = document.getElementById('injectionStatus');
      const detailEl = document.getElementById('injectionDetail');
      if (injection) {
        iconEl.className = 'material-symbols-outlined pf-injection-icon detected';
        iconEl.textContent = 'gpp_bad';
        statusEl.className = 'pf-injection-status detected';
        statusEl.textContent = 'INJECTION DETECTED';
        detailEl.textContent = 'Pattern: ' + injection.snippet;
      } else {
        iconEl.className = 'material-symbols-outlined pf-injection-icon clean';
        iconEl.textContent = 'verified_user';
        statusEl.className = 'pf-injection-status clean';
        statusEl.textContent = 'CLEAN';
        detailEl.textContent = 'No injection patterns found';
      }

      // Summary
      if (fw && fw.verification && fw.verification.checks) {
        const passed = fw.verification.checks.filter(c => c.status === 'pass').length;
        document.getElementById('checksPassedVal').textContent =
          passed + '/' + fw.verification.checks.length;
      }
      document.getElementById('piiCountVal').textContent = String(pii.length);
      document.getElementById('tasksCountVal').textContent =
        fw && fw.taskBreakdown ? String(fw.taskBreakdown.length) : '0';

      // Checks
      if (fw && fw.verification && fw.verification.checks && fw.verification.checks.length > 0) {
        const sec = document.getElementById('checksSection');
        sec.style.display = '';
        const list = document.getElementById('checksList');
        list.innerHTML = fw.verification.checks.map(c => {
          const iconCls = c.status === 'pass' ? 'pass' : c.status === 'fail' ? 'fail' : 'warning';
          const iconText = c.status === 'pass' ? 'check_circle' : c.status === 'fail' ? 'cancel' : 'warning';
          return '<div class="pf-check ' + iconCls + '">' +
            '<span class="material-symbols-outlined pf-check-icon ' + iconCls + '">' + iconText + '</span>' +
            '<div class="pf-check-body">' +
              '<div class="pf-check-name">' + esc(c.name) + '</div>' +
              '<div class="pf-check-msg">' + esc(c.message) + '</div>' +
              (c.evidence ? '<div class="pf-check-evidence">' + esc(c.evidence) + '</div>' : '') +
            '</div></div>';
        }).join('');
      }

      // Tasks
      if (fw && fw.taskBreakdown && fw.taskBreakdown.length > 0) {
        const sec = document.getElementById('tasksSection');
        sec.style.display = '';
        const list = document.getElementById('tasksList');
        list.innerHTML = fw.taskBreakdown.map(t => {
          return '<div class="pf-task">' +
            '<span class="pf-task-priority ' + t.priority + '">' + t.priority + '</span>' +
            '<div class="pf-task-body">' +
              '<div class="pf-task-title">' + esc(t.title) + '</div>' +
              '<div class="pf-task-desc">' + esc(t.description) + '</div>' +
              '<div class="pf-task-meta">' + Math.round(t.estimatedTime) + ' min</div>' +
            '</div></div>';
        }).join('');
      }

      // Fixes
      if (fw && fw.immediateFixes && fw.immediateFixes.length > 0) {
        const sec = document.getElementById('fixesSection');
        sec.style.display = '';
        const list = document.getElementById('fixesList');
        list.innerHTML = fw.immediateFixes.map(f => {
          return '<div class="pf-fix">' +
            '<div class="pf-fix-header">' +
              '<span class="pf-fix-type">' + f.type + '</span>' +
              '<button class="pf-fix-apply" id="fix-btn-' + f.id + '" onclick="applyFix(\\'' + f.id + '\\')">' +
                'APPLY FIX</button>' +
            '</div>' +
            '<div class="pf-fix-desc">' + esc(f.description) + '</div>' +
            '<div class="pf-fix-file">' + esc(f.file) + '</div>' +
            '<div class="pf-fix-diff">' +
              '<div class="pf-fix-before">' + esc(f.change.before) + '</div>' +
              '<div class="pf-fix-after">' + esc(f.change.after) + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }

      // Recommendations
      if (fw && fw.recommendations && fw.recommendations.length > 0) {
        const sec = document.getElementById('recsSection');
        sec.style.display = '';
        const list = document.getElementById('recsList');
        list.innerHTML = fw.recommendations.map(r => {
          return '<div class="pf-rec">' +
            '<span class="material-symbols-outlined pf-rec-icon">arrow_forward</span>' +
            '<span>' + esc(r) + '</span>' +
          '</div>';
        }).join('');
      }

      // Upgrade CTA (free tier — details locked)
      const upgradeEl = document.getElementById('upgradeCta');
      if (result.detailsLocked) {
        upgradeEl.style.display = '';
        const url = result.upgradeUrl || 'https://guardrailai.dev/billing';
        upgradeEl.innerHTML =
          '<div style="text-align:center;padding:24px;background:rgba(0,229,255,0.04);border:1px solid rgba(0,229,255,0.15);border-radius:8px;">' +
            '<span class="material-symbols-outlined" style="font-size:32px;color:#22d3ee;">lock</span>' +
            '<h3 style="font-family:\\'Space Grotesk\\',sans-serif;font-size:15px;font-weight:700;color:var(--on-surface);margin:12px 0 8px;">Details Locked (Free Plan)</h3>' +
            '<p style="font-size:12px;color:var(--on-surface-variant);margin-bottom:16px;">Upgrade for full task breakdowns, immediate fixes, evidence details, and future plans.</p>' +
            '<button onclick="vscode.postMessage({command:\\'openBilling\\'})" style="' +
              'background:linear-gradient(135deg,#22d3ee,#06b6d4);color:#001f24;border:none;padding:8px 24px;border-radius:4px;' +
              'font-family:\\'Space Grotesk\\',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.06em;cursor:pointer;">' +
              'UPGRADE NOW</button>' +
          '</div>';
      } else {
        upgradeEl.style.display = 'none';
      }
    }

    function esc(s) {
      if (!s) return '';
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      switch (msg.type) {
        case 'analyzing':
          hideError();
          document.getElementById('analyzeBtn').disabled = true;
          setProgress('Starting analysis...', msg.progress || 0);
          break;
        case 'progress':
          setProgress(msg.message, msg.progress);
          break;
        case 'complete':
          hideProgress();
          document.getElementById('analyzeBtn').disabled = false;
          currentResult = msg.result;
          renderResult(currentResult);
          break;
        case 'fixApplied':
          const btn = document.getElementById('fix-btn-' + msg.fixId);
          if (btn) {
            btn.textContent = msg.success ? 'APPLIED' : 'FAILED';
            btn.classList.toggle('applied', msg.success);
            btn.disabled = true;
          }
          break;
        case 'error':
          hideProgress();
          document.getElementById('analyzeBtn').disabled = false;
          showError(msg.message);
          break;
      }
    });

    // Allow Ctrl+Enter to trigger analysis
    document.getElementById('promptInput').addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { analyze(); }
    });
  </script>
</body>
</html>`;
}
