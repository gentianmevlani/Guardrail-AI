/**
 * Cyber-Circuit AI Explainer — CSP-safe webview markup (no Tailwind CDN).
 */

export function getAiExplainerCyberCircuitHtml(
  kineticVersion: string,
  headHtml: string,
): string {
  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyber-Circuit AI Explainer</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
  ${headHtml}
</head>
<body class="ka-dashboard-body ka-ce-page">
  <div class="ka-ce-glow ka-ce-glow-br" aria-hidden="true"></div>
  <div class="ka-ce-glow ka-ce-glow-tl" aria-hidden="true"></div>

  <aside class="ka-ce-rail" aria-label="Feature navigation">
    <div class="ka-ce-rail-brand">
      <span class="material-symbols-outlined ka-ce-rail-icon-fill">terminal</span>
      <span class="ka-ce-rail-logo">CYBER-CIRCUIT</span>
    </div>
    <nav class="ka-ce-rail-nav">
      <button type="button" class="ka-ce-rail-btn" onclick="runCmd('workbench.view.explorer')">
        <span class="material-symbols-outlined">account_tree</span>
        <span class="ka-ce-rail-label">Explorer</span>
      </button>
      <button type="button" class="ka-ce-rail-btn" onclick="runCmd('guardrail.openSecurityScanner')">
        <span class="material-symbols-outlined">security</span>
        <span class="ka-ce-rail-label">Security Scan</span>
      </button>
      <button type="button" class="ka-ce-rail-btn ka-ce-rail-active" aria-current="page">
        <span class="material-symbols-outlined ka-ce-rail-icon-fill">terminal</span>
        <span class="ka-ce-rail-label">AI Explainer</span>
      </button>
      <div class="ka-ce-rail-spacer"></div>
      <button type="button" class="ka-ce-rail-btn" onclick="runCmd('workbench.action.openSettings')">
        <span class="material-symbols-outlined">settings</span>
        <span class="ka-ce-rail-label">Settings</span>
      </button>
    </nav>
  </aside>

  <header class="ka-ce-topbar">
    <div class="ka-ce-topbar-left">
      <span class="material-symbols-outlined ka-ce-topbar-ico">smart_toy</span>
      <h1 class="ka-ce-topbar-title">AI Code Explainer</h1>
    </div>
    <div class="ka-ce-topbar-right">
      <div class="ka-ce-topbar-links">
        <button type="button" class="ka-ce-link-quiet" onclick="runCmd('guardrail.openWebDashboard')">Documentation</button>
        <button type="button" class="ka-ce-link-quiet" onclick="runCmd('guardrail.openaiApiKey')">API Keys</button>
      </div>
      <div class="ka-ce-avatar" title="Guardrail">G</div>
    </div>
  </header>

  <main class="ka-ce-main">
    <section class="ka-ce-hero-grid" aria-labelledby="ce-input-heading">
      <div class="ka-ce-col-input">
        <h2 id="ce-input-heading" class="sr-only">Code input</h2>
        <div class="ka-ce-code-shell">
          <div class="ka-ce-code-head">
            <div class="ka-ce-dots" aria-hidden="true">
              <span class="ka-ce-dot ka-ce-dot-r"></span>
              <span class="ka-ce-dot ka-ce-dot-y"></span>
              <span class="ka-ce-dot ka-ce-dot-g"></span>
            </div>
            <span class="ka-ce-code-title">Input: <span id="inputFileLabel">Code</span></span>
          </div>
          <textarea id="codeInput" class="ka-ce-textarea" rows="12" spellcheck="false"
            placeholder="// Paste your code here or enter a Finding ID..."></textarea>
        </div>

        <div class="ka-ce-actions-row">
          <div class="ka-ce-actions-left">
            <button type="button" class="ka-ce-btn-primary" id="explainBtn" onclick="explainCode()">
              <span class="material-symbols-outlined">smart_toy</span>
              EXPLAIN CODE
            </button>
            <button type="button" class="ka-ce-btn-secondary" onclick="explainFile()">
              <span class="material-symbols-outlined">upload_file</span>
              Import
            </button>
          </div>
          <div class="ka-ce-ready">
            <span class="ka-ce-ready-dot"></span>
            <span>System Ready: Kinetic Core v${kineticVersion}</span>
          </div>
        </div>
        <div class="ka-ce-subactions">
          <button type="button" class="ka-ce-link" onclick="explainSelection()">Explain selection</button>
          <span class="ka-ce-subdot">·</span>
          <button type="button" class="ka-ce-link" onclick="explainFile()">Current file</button>
        </div>

        <div class="ka-ce-progress" id="progressContainer" style="display:none">
          <div id="progressMessage" class="ka-ce-progress-msg">Analyzing…</div>
          <div class="ka-ce-progress-bar">
            <div class="ka-ce-progress-fill" id="progressFill" style="width:0%"></div>
          </div>
        </div>
      </div>

      <div class="ka-ce-col-config">
        <div class="ka-ce-config-card">
          <h3 class="ka-ce-config-head">
            <span class="material-symbols-outlined">tune</span>
            Configuration
          </h3>
          <div class="ka-ce-config-body">
            <div class="ka-ce-field">
              <label class="ka-ce-field-lbl">Detail Level</label>
              <div class="ka-ce-seg" id="detailSeg" role="group" aria-label="Detail level">
                <button type="button" class="ka-ce-seg-btn" data-level="basic" onclick="setDetailLevel('basic')">BASIC</button>
                <button type="button" class="ka-ce-seg-btn is-active" data-level="detailed" onclick="setDetailLevel('detailed')">DETAILED</button>
                <button type="button" class="ka-ce-seg-btn" data-level="comprehensive" onclick="setDetailLevel('comprehensive')">COMPREHENSIVE</button>
              </div>
            </div>
            <div class="ka-ce-toggle-row">
              <div>
                <p class="ka-ce-toggle-title">Include Examples</p>
                <p class="ka-ce-toggle-sub">Code snippets in output</p>
              </div>
              <button type="button" class="ka-ce-switch is-on" id="includeExamplesToggle" onclick="toggleIncludeExamples()" aria-pressed="true"></button>
            </div>
            <label class="ka-ce-field-lbl ka-ce-finding-lbl" for="findingIdInput">Finding ID (optional — <code>guardrail explain &lt;id&gt;</code>)</label>
            <input type="text" id="findingIdInput" class="ka-ce-input" placeholder="From guardrail scan --json" autocomplete="off" />
            <div class="ka-ce-quota">
              <p class="ka-ce-quota-txt">QUOTA: 1,420 / 5,000 TOKENS</p>
              <div class="ka-ce-quota-track"><div class="ka-ce-quota-fill"></div></div>
            </div>
          </div>
        </div>

        <div class="ka-ce-model-card" aria-hidden="true">
          <div class="ka-ce-model-bg"></div>
          <div class="ka-ce-model-fade"></div>
          <div class="ka-ce-model-copy">
            <p class="ka-ce-model-k">KINETIC-MODELS</p>
            <p class="ka-ce-model-sub">Llama-3-70B Active</p>
          </div>
        </div>
      </div>
    </section>

    <section class="ka-ce-results" id="resultsSection" style="display:none" aria-live="polite">
      <div class="ka-ce-results-head">
        <h2 class="ka-ce-results-title">Analysis Results</h2>
        <div class="ka-ce-results-line"></div>
      </div>
      <div class="ka-ce-results-grid">
        <div class="ka-ce-summary-card">
          <div class="ka-ce-summary-glow" aria-hidden="true"></div>
          <div class="ka-ce-summary-top">
            <div class="ka-ce-summary-left">
              <div class="ka-ce-icon-box">
                <span class="material-symbols-outlined ka-ce-ico-lg">psychology</span>
              </div>
              <div>
                <h4 class="ka-ce-algo-title" id="algoTitle">Algorithm Summary</h4>
                <div class="ka-ce-meta-row">
                  <span class="ka-ce-chip" id="complexityChip">MODERATE COMPLEXITY</span>
                  <span class="ka-ce-read">
                    <span class="material-symbols-outlined ka-ce-ico-xs">timer</span>
                    <span id="readingTime">—</span>
                  </span>
                </div>
              </div>
            </div>
            <button type="button" class="ka-ce-icon-btn" onclick="shareSummary()" title="Copy summary">
              <span class="material-symbols-outlined">share</span>
            </button>
          </div>
          <p class="ka-ce-summary-body" id="summaryText"></p>
          <div class="ka-ce-purpose">
            <h5 class="ka-ce-purpose-lbl">Primary Purpose</h5>
            <p class="ka-ce-purpose-quote" id="purposeQuote"></p>
          </div>
          <div class="ka-ce-two-col">
            <div>
              <h5 class="ka-ce-mini-h">Key Components</h5>
              <ul class="ka-ce-kc-list" id="componentList"></ul>
            </div>
            <div>
              <h5 class="ka-ce-mini-h">Identified Patterns</h5>
              <div class="ka-ce-chips" id="patternChips"></div>
            </div>
          </div>
        </div>

        <div class="ka-ce-side-col">
          <div class="ka-ce-opt-card">
            <h4 class="ka-ce-opt-head">
              <span class="material-symbols-outlined">bolt</span>
              Optimizations
            </h4>
            <div id="optList" class="ka-ce-opt-list"></div>
          </div>
          <div class="ka-ce-side-btns">
            <button type="button" class="ka-ce-outline-btn" onclick="generateDocs()">
              <span class="material-symbols-outlined">description</span>
              Generate Documentation
            </button>
            <button type="button" class="ka-ce-outline-btn" onclick="exportExplanation()">
              <span class="material-symbols-outlined">download</span>
              Export Explanation
            </button>
            <button type="button" class="ka-ce-feedback-btn" onclick="sendFeedback()">
              <span class="material-symbols-outlined">feedback</span>
              Rate Accuracy
            </button>
          </div>
        </div>
      </div>
    </section>
  </main>

  <nav class="ka-ce-mobile-nav" aria-label="Mobile shortcuts">
    <button type="button" class="ka-ce-mnav-btn" onclick="runCmd('workbench.action.focusActiveEditorGroup')">
      <span class="material-symbols-outlined">code</span>
    </button>
    <button type="button" class="ka-ce-mnav-btn ka-ce-mnav-active">
      <span class="material-symbols-outlined ka-ce-rail-icon-fill">terminal</span>
    </button>
    <button type="button" class="ka-ce-mnav-btn" onclick="runCmd('guardrail.openSecurityScanner')">
      <span class="material-symbols-outlined">history</span>
    </button>
  </nav>

  <script>
    const vscode = acquireVsCodeApi();
    var currentExplanation = null;

    function runCmd(id) { vscode.postMessage({ command: 'vscodeCommand', id: id }); }

    function setDetailLevel(level) {
      document.querySelectorAll('.ka-ce-seg-btn').forEach(function(btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-level') === level);
      });
    }
    function getDetailLevel() {
      var a = document.querySelector('.ka-ce-seg-btn.is-active');
      return a ? a.getAttribute('data-level') : 'detailed';
    }
    function toggleIncludeExamples() {
      var el = document.getElementById('includeExamplesToggle');
      el.classList.toggle('is-on');
      el.setAttribute('aria-pressed', el.classList.contains('is-on') ? 'true' : 'false');
    }
    function getIncludeExamples() {
      return document.getElementById('includeExamplesToggle').classList.contains('is-on');
    }

    function explainCode() {
      var code = document.getElementById('codeInput').value;
      var findingId = document.getElementById('findingIdInput').value.trim();
      var detailLevel = getDetailLevel();
      var includeExamples = getIncludeExamples();
      if (!findingId && !code.trim()) {
        alert('Enter a finding ID for CLI explain, or paste code for the API');
        return;
      }
      document.getElementById('explainBtn').disabled = true;
      vscode.postMessage({
        command: 'explain',
        request: { code: code, detailLevel: detailLevel, includeExamples: includeExamples, language: 'typescript', findingId: findingId }
      });
    }
    function explainSelection() { vscode.postMessage({ command: 'explainSelection' }); }
    function explainFile() { vscode.postMessage({ command: 'explainFile' }); }
    function exportExplanation() { vscode.postMessage({ command: 'export' }); }
    function generateDocs() { vscode.postMessage({ command: 'generateDocs' }); }
    function sendFeedback() { vscode.postMessage({ command: 'feedback' }); }
    function shareSummary() {
      var t = document.getElementById('summaryText');
      if (t && t.textContent) {
        vscode.postMessage({ command: 'copyText', text: t.textContent });
      }
    }

    function complexityLabel(c) {
      var u = (c || 'moderate').toUpperCase();
      if (u === 'SIMPLE') return 'LOW COMPLEXITY';
      if (u === 'COMPLEX') return 'HIGH COMPLEXITY';
      return 'MODERATE COMPLEXITY';
    }

    function renderExplanation(explanation) {
      currentExplanation = explanation;
      document.getElementById('explainBtn').disabled = false;
      document.getElementById('resultsSection').style.display = 'block';
      document.getElementById('algoTitle').textContent = 'Algorithm Summary';
      document.getElementById('complexityChip').textContent = complexityLabel(explanation.complexity);
      var rt = explanation.estimatedTime || '—';
      document.getElementById('readingTime').textContent = (rt === '—' ? rt : rt + ' read');
      document.getElementById('summaryText').textContent = explanation.summary || '';
      document.getElementById('purposeQuote').textContent = '"' + (explanation.purpose || '') + '"';

      var compEl = document.getElementById('componentList');
      while (compEl.firstChild) { compEl.removeChild(compEl.firstChild); }
      if (explanation.keyComponents && explanation.keyComponents.length) {
        explanation.keyComponents.forEach(function(comp) {
          var li = document.createElement('li');
          li.className = 'ka-ce-kc-row';
          var s1 = document.createElement('span');
          s1.textContent = comp.name;
          var s2 = document.createElement('span');
          s2.className = 'ka-ce-kc-meta';
          s2.textContent = 'Ln ' + String(comp.line);
          li.appendChild(s1);
          li.appendChild(s2);
          compEl.appendChild(li);
        });
      } else {
        var emptyLi = document.createElement('li');
        emptyLi.className = 'ka-ce-kc-empty';
        emptyLi.textContent = 'No structured components in this response.';
        compEl.appendChild(emptyLi);
      }

      var patEl = document.getElementById('patternChips');
      while (patEl.firstChild) { patEl.removeChild(patEl.firstChild); }
      if (explanation.patterns && explanation.patterns.length) {
        explanation.patterns.forEach(function(p) {
          var sp = document.createElement('span');
          sp.className = 'ka-ce-chip-outline';
          sp.textContent = p.name;
          patEl.appendChild(sp);
        });
      } else {
        var dash = document.createElement('span');
        dash.className = 'ka-ce-chip-muted';
        dash.textContent = '—';
        patEl.appendChild(dash);
      }

      var optEl = document.getElementById('optList');
      while (optEl.firstChild) { optEl.removeChild(optEl.firstChild); }
      var sugs = explanation.suggestions || [];
      if (sugs.length) {
        sugs.forEach(function(s, i) {
          var pri = i === 0 ? 'High Priority' : (i === 1 ? 'Low Priority' : 'Suggestion');
          var priClass = i === 0 ? 'ka-ce-pri-hi' : (i === 1 ? 'ka-ce-pri-lo' : 'ka-ce-pri-md');
          var div = document.createElement('div');
          div.className = 'ka-ce-opt-item';
          var row = document.createElement('div');
          row.className = 'ka-ce-opt-row';
          var t1 = document.createElement('span');
          t1.className = 'ka-ce-opt-title';
          t1.textContent = 'Suggestion ' + (i + 1);
          var t2 = document.createElement('span');
          t2.className = priClass;
          t2.textContent = pri;
          row.appendChild(t1);
          row.appendChild(t2);
          var p = document.createElement('p');
          p.className = 'ka-ce-opt-desc';
          p.textContent = s;
          div.appendChild(row);
          div.appendChild(p);
          optEl.appendChild(div);
        });
      } else {
        var emptyP = document.createElement('p');
        emptyP.className = 'ka-ce-opt-empty';
        emptyP.textContent = 'No optimization hints for this run.';
        optEl.appendChild(emptyP);
      }

      document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    window.addEventListener('message', function(event) {
      var message = event.data;
      switch (message.type) {
        case 'explaining':
        case 'progress':
          document.getElementById('progressContainer').style.display = 'block';
          document.getElementById('progressMessage').textContent = message.message || 'Analyzing…';
          document.getElementById('progressFill').style.width = (message.progress || 0) + '%';
          break;
        case 'complete':
          document.getElementById('progressContainer').style.display = 'none';
          renderExplanation(message.explanation);
          break;
        case 'error':
          document.getElementById('progressContainer').style.display = 'none';
          document.getElementById('explainBtn').disabled = false;
          alert('Error: ' + message.message);
          break;
      }
    });

    setDetailLevel('detailed');
  </script>
</body>
</html>`;
}
