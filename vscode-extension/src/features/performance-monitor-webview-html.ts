/**
 * Performance Monitor — Nexus Monitor shell (Stitch world_class_performance_monitor).
 */

export function getPerformanceMonitorNexusHtml(headHtml: string): string {
  return `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Monitor</title>
  ${headHtml}
</head>
<body class="ka-dashboard-body ka-panel-page pm-page">
  <div class="ka-ambient" aria-hidden="true"></div>
  <header class="pm-nexus-head">
    <div class="pm-nexus-brand">
      <span class="material-symbols-outlined">speed</span>
      <h1 class="pm-nexus-title">Nexus Monitor</h1>
    </div>
    <div class="pm-nexus-actions">
      <button type="button" class="pm-btn-ghost" onclick="refresh()">
        <span class="material-symbols-outlined" style="font-size:18px;">refresh</span> Refresh
      </button>
      <button type="button" class="pm-btn-primary-nx" onclick="optimize()">Optimize Engine</button>
      <button type="button" class="pm-btn-ghost" onclick="exportReport()" title="Export">
        <span class="material-symbols-outlined">ios_share</span>
      </button>
    </div>
  </header>

  <main class="pm-main">
    <div class="pm-grid-top">
      <div class="pm-glass">
        <div class="pm-scanner-beam" aria-hidden="true"></div>
        <p style="font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:var(--on-surface-variant);margin:0 0 16px;opacity:0.75;">Core Health Matrix</p>
        <div class="pm-ring-wrap">
          <svg width="200" height="200" viewBox="0 0 200 200" style="transform:rotate(-90deg);">
            <circle cx="100" cy="100" r="90" fill="transparent" stroke="var(--surface-container-highest)" stroke-width="2" opacity="0.35"></circle>
            <circle id="pmScoreRing" cx="100" cy="100" r="90" fill="transparent" stroke="url(#pmGrad)" stroke-width="10"
              stroke-dasharray="565.48" stroke-dashoffset="565.48" stroke-linecap="round"></circle>
            <defs>
              <linearGradient id="pmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#c3f5ff"></stop>
                <stop offset="100%" stop-color="#00e5ff"></stop>
              </linearGradient>
            </defs>
          </svg>
          <div class="pm-ring-center">
            <span class="pm-score-big" id="scoreValue">--</span>
            <span style="font-size:10px;color:var(--on-surface-variant);letter-spacing:0.3em;margin-top:4px;">STABLE</span>
          </div>
        </div>
      </div>

      <div class="pm-metrics-grid" id="metricsGrid">
        <div class="pm-metric-tile">
          <span class="material-symbols-outlined" style="color:var(--primary);font-size:22px;">memory</span>
          <div class="metric-value" id="cpuValue">--</div>
          <div class="metric-label">CPU Usage</div>
        </div>
        <div class="pm-metric-tile">
          <span class="material-symbols-outlined" style="color:var(--primary-fixed-dim);font-size:22px;">database</span>
          <div class="metric-value" id="memoryValue">--</div>
          <div class="metric-label">Memory</div>
        </div>
        <div class="pm-metric-tile">
          <span class="material-symbols-outlined" style="color:var(--error);font-size:22px;">swap_horiz</span>
          <div class="metric-value" id="ioValue">--</div>
          <div class="metric-label">I/O</div>
        </div>
        <div class="pm-metric-tile">
          <span class="material-symbols-outlined" style="color:var(--primary-fixed-dim);font-size:22px;">router</span>
          <div class="metric-value" id="networkValue">--</div>
          <div class="metric-label">Network</div>
        </div>
        <div class="pm-metric-tile">
          <span class="material-symbols-outlined" style="color:var(--primary-fixed-dim);font-size:22px;">grid_view</span>
          <div class="metric-value" id="renderValue">--</div>
          <div class="metric-label">Render</div>
        </div>
      </div>
    </div>

    <div class="pm-glass pm-chart">
      <span class="material-symbols-outlined" style="font-size:40px;opacity:0.35;margin-right:12px;">show_chart</span>
      <span>Profiling stream connects when live data is available.</span>
    </div>

    <div class="pm-insights">
      <h3><span class="material-symbols-outlined" style="font-size:20px;">query_stats</span> Intelligence Insights</h3>
      <div id="insightsList">
        <div class="insight-item insight-low">
          <div class="insight-title">Performance is nominal</div>
          <div class="insight-description">No blocking issues detected from the latest guardrail scan output.</div>
        </div>
      </div>
    </div>
  </main>

  <script>
    const vscode = acquireVsCodeApi();

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function optimize() {
      vscode.postMessage({ command: 'getSuggestions' });
    }

    function exportReport() {
      vscode.postMessage({ command: 'export', format: 'json' });
    }

    function setScoreRing(pct) {
      var el = document.getElementById('pmScoreRing');
      if (!el) return;
      var c = 565.48;
      var p = Math.max(0, Math.min(100, pct));
      el.setAttribute('stroke-dashoffset', String(c * (1 - p / 100)));
    }

    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'metrics':
          updateMetrics(message.data);
          break;
        case 'monitoring':
          updateMonitoringStatus(message.status);
          break;
        case 'error':
          showError(message.message);
          break;
      }
    });

    function updateMetrics(data) {
      if (data.metrics) {
        data.metrics.forEach(metric => {
          const element = document.getElementById(metric.type + 'Value');
          if (element) {
            element.textContent = metric.value + metric.unit;
            element.className = 'metric-value metric-' + metric.status;
          }
        });
      }

      if (data.summary) {
        const scoreElement = document.getElementById('scoreValue');
        if (scoreElement) {
          const score = Math.max(0, 100 - (data.summary.issues * 10));
          scoreElement.textContent = score + '%';
          scoreElement.className = 'pm-score-big';
          scoreElement.style.color = score > 80 ? '#6ee7b7' : score > 60 ? '#ffd93d' : '#ff6b6b';
          setScoreRing(score);
        }
      }
    }

    function updateMonitoringStatus(isMonitoring) {
      void isMonitoring;
    }

    function showError(message) {
      void message;
    }

    refresh();
  </script>
</body>
</html>`;
}
